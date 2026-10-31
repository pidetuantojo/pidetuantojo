// SOLO servidor: apertura de turno y consultas. Un turno = una caja registradora + un cajero.
// La unicidad se garantiza con candados creados con `tx.create` (falla si ya existen).
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { CashError } from './cash.errors';
import { cashCollectionPath, cashDocPath, cashierLockId, registerLockId } from './cash.paths';
import type { CashShift, CountMap, ShiftStatus } from './cash.types';
import { compactCount, computeCountTotal } from './denominations.helpers';
import { createMovementContext } from './movement.context.server';
import { prepareRegisterMovement } from './movement.server';

export interface OpenShiftInput {
  registerId: string;
  openingCount: CountMap;
}

export async function openShift(
  restaurantId: string,
  input: OpenShiftInput,
  meta: MutationMeta
): Promise<CashShift> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CashShift>(tx, {
      restaurantId,
      scope: 'cash.shift.open',
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    const register = await ctx.registerOf(input.registerId);
    if (register.type !== 'REGISTRADORA' || !register.isActive) {
      throw new CashError(
        'INVALID_REGISTER',
        'Solo se abren turnos en cajas registradoras activas'
      );
    }
    const openingTotal = computeCountTotal(input.openingCount, ctx.settings.denominations);
    const generalId = ctx.settings.defaultGeneralRegisterId;
    if (openingTotal > 0 && !generalId) {
      throw new CashError(
        'NO_GENERAL_REGISTER',
        'Configura la caja general en los ajustes de caja'
      );
    }

    const registerLock = adminDb.doc(
      cashDocPath(restaurantId, 'locks', registerLockId(register.id))
    ) as DocumentReference;
    const cashierLock = adminDb.doc(
      cashDocPath(restaurantId, 'locks', cashierLockId(audit.uid))
    ) as DocumentReference;
    const [registerLockSnap, cashierLockSnap] = [
      await tx.get(registerLock),
      await tx.get(cashierLock),
    ];
    if (registerLockSnap.exists) {
      throw new CashError('REGISTER_HAS_OPEN_SHIFT', 'Esa caja ya tiene un turno abierto');
    }
    if (cashierLockSnap.exists) {
      throw new CashError('CASHIER_HAS_OPEN_SHIFT', 'Ya tienes un turno abierto en otra caja');
    }

    const shiftRef = adminDb.collection(cashCollectionPath(restaurantId, 'shifts')).doc();
    const shift: CashShift = {
      id: shiftRef.id,
      registerId: register.id,
      cashierUid: audit.uid,
      status: 'ABIERTO',
      openedAt: audit.at,
      openingAccountingDate: audit.accountingDate,
      openingCount: compactCount(input.openingCount),
      openingTotal,
      audit: { ...audit, registerId: register.id, shiftId: shiftRef.id },
    };
    ctx.seedShift(shift);

    const base =
      openingTotal > 0
        ? await prepareRegisterMovement(ctx, {
            type: 'BASE_APERTURA',
            amount: openingTotal,
            methodType: 'efectivo',
            registerId: register.id,
            shiftId: shift.id,
            counterpartRegisterId: generalId,
            reason: 'Base de apertura',
          })
        : null;
    if (base) shift.openingMovementId = base.movement.id;

    // Escrituras
    const lock = { shiftId: shift.id, createdAt: audit.at };
    tx.create(registerLock, { ...lock, registerId: register.id });
    tx.create(cashierLock, { ...lock, cashierUid: audit.uid });
    base?.commit(tx);
    tx.create(shiftRef as DocumentReference, shift);
    writeAuditLog(tx, restaurantId, {
      action: 'cash.shift.opened',
      entityType: 'cashShift',
      entityId: shift.id,
      context: shift.audit,
      data: { registerId: register.id, openingTotal },
    });
    idem.save(tx, shift);
    return shift;
  });
}

/** Turno vigente del cajero (cualquier estado distinto de CERRADO), a través de su candado. */
export async function getCurrentShift(
  restaurantId: string,
  uid: string
): Promise<CashShift | null> {
  const lock = await adminDb.doc(cashDocPath(restaurantId, 'locks', cashierLockId(uid))).get();
  if (!lock.exists) return null;
  const { shiftId } = lock.data() as { shiftId: string };
  const snap = await adminDb.doc(cashDocPath(restaurantId, 'shifts', shiftId)).get();
  return snap.exists ? { ...(snap.data() as CashShift), id: snap.id } : null;
}

export async function listShifts(restaurantId: string, status?: ShiftStatus): Promise<CashShift[]> {
  const col = adminDb.collection(cashCollectionPath(restaurantId, 'shifts'));
  // Con filtro de estado se ordena en memoria (evita un índice compuesto)
  const snap = await (
    status ? col.where('status', '==', status) : col.orderBy('openedAt', 'desc').limit(200)
  ).get();
  return snap.docs
    .map((d) => ({ ...(d.data() as CashShift), id: d.id }))
    .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
    .slice(0, 200);
}
