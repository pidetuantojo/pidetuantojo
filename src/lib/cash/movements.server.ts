// SOLO servidor: casos de uso de movimientos manuales (ingreso vario, egreso, retiro parcial),
// decisión sobre retiros pendientes y reversos.
import type { DocumentReference } from 'firebase-admin/firestore';

import { AuthError } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { stripUndefined } from '@/lib/ledger/ledger.paths';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';
import type { PaymentMethodType } from '@/types';

import { CashError } from './cash.errors';
import { cashCollectionPath, cashDocPath } from './cash.paths';
import type { CashMovement } from './cash.types';
import { createMovementContext, type MovementContext } from './movement.context.server';
import { prepareEntryForMovement } from './movement.entry.server';
import { assertReversible } from './movement.helpers';
import { buildMirrorMovement } from './movement.mirror';
import { balanceDeltaOf, prepareRegisterMovement } from './movement.server';

export interface ManualMovementInput {
  type: 'INGRESO_VARIO' | 'EGRESO' | 'RETIRO_PARCIAL';
  amount: number;
  methodType: PaymentMethodType;
  paymentMethodId?: string;
  counterpartRegisterId?: string;
  reason: string;
}

async function readMovement(ctx: MovementContext, movementId: string): Promise<CashMovement> {
  const snap = await ctx.tx.get(
    adminDb.doc(cashDocPath(ctx.restaurantId, 'movements', movementId)) as DocumentReference
  );
  if (!snap.exists) throw new CashError('MOVEMENT_NOT_FOUND', 'El movimiento no existe');
  return { ...(snap.data() as CashMovement), id: snap.id };
}

/** El cajero del turno registra un ingreso, egreso o retiro. El retiro queda pendiente de aprobación. */
export async function createManualMovement(
  restaurantId: string,
  shiftId: string,
  input: ManualMovementInput,
  meta: MutationMeta
): Promise<CashMovement> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CashMovement>(tx, {
      restaurantId,
      scope: `cash.movement.create:${shiftId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    const shift = await ctx.shiftOf(shiftId);
    if (shift.cashierUid !== audit.uid) {
      throw new AuthError('Solo el cajero del turno puede registrar movimientos', 403);
    }
    if (input.type === 'RETIRO_PARCIAL' && input.methodType !== 'efectivo') {
      throw new CashError('INVALID_METHOD', 'Los retiros parciales son solo en efectivo');
    }

    const prepared = await prepareRegisterMovement(
      { ...ctx, audit: { ...audit, registerId: shift.registerId, shiftId } },
      {
        type: input.type,
        amount: input.amount,
        methodType: input.methodType,
        paymentMethodId: input.paymentMethodId,
        registerId: shift.registerId,
        shiftId,
        counterpartRegisterId: input.counterpartRegisterId,
        reason: input.reason,
        status: input.type === 'RETIRO_PARCIAL' ? 'PENDIENTE_APROBACION' : 'APLICADO',
      }
    );
    const movement = prepared.commit(tx);
    idem.save(tx, movement);
    return movement;
  });
}

export interface DecideWithdrawalInput {
  decision: 'APROBAR' | 'RECHAZAR';
  note?: string;
}

/** Un supervisor distinto del cajero aprueba (asiento + aplicado) o rechaza un retiro pendiente. */
export async function decideWithdrawal(
  restaurantId: string,
  shiftId: string,
  movementId: string,
  input: DecideWithdrawalInput,
  meta: MutationMeta
): Promise<CashMovement> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CashMovement>(tx, {
      restaurantId,
      scope: `cash.withdrawal.decide:${movementId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: { shiftId, ...input },
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    const movement = await readMovement(ctx, movementId);
    if (movement.shiftId !== shiftId || movement.type !== 'RETIRO_PARCIAL') {
      throw new CashError('MOVEMENT_NOT_FOUND', 'El retiro no existe en este turno');
    }
    if (movement.status !== 'PENDIENTE_APROBACION') {
      throw new CashError('MOVEMENT_NOT_PENDING', 'El retiro ya fue resuelto');
    }
    if (audit.uid === movement.cashierUid || audit.uid === movement.audit.uid) {
      throw new AuthError('No puedes aprobar un retiro que tú mismo registraste', 403);
    }
    const shift = await ctx.shiftOf(shiftId);
    if (shift.status !== 'ABIERTO') {
      throw new CashError('INVALID_SHIFT_STATE', 'El turno ya no admite decisiones sobre retiros');
    }

    const ref = adminDb.doc(
      cashDocPath(restaurantId, 'movements', movementId)
    ) as DocumentReference;
    const decisionAudit = { ...audit, registerId: movement.registerId, shiftId };
    const decisionCtx = { ...ctx, audit: decisionAudit };
    const approve = input.decision === 'APROBAR';
    const prepared = approve
      ? await prepareEntryForMovement(decisionCtx, movement, {
          accountingDate: audit.accountingDate,
        })
      : null;

    const counterpartId = movement.counterpartRegisterId ?? ctx.settings.defaultGeneralRegisterId;
    if (approve && counterpartId) await ctx.registerOf(counterpartId);
    if (approve) {
      await ctx.balances.load(movement.registerId);
      if (counterpartId) await ctx.balances.load(counterpartId);
    }

    const patch = stripUndefined({
      status: approve ? ('APLICADO' as const) : ('RECHAZADO' as const),
      approvedBy: audit.uid,
      decisionNote: input.note,
      ...(approve
        ? {
            accountingDate: audit.accountingDate,
            journalEntryId: prepared?.entry?.entryId ?? null,
            journalSkippedReason: prepared?.skippedReason,
            counterpartRegisterId: counterpartId,
            transferId: movement.id,
          }
        : {}),
    });
    prepared?.entry?.commit(tx);
    tx.update(ref, patch);
    if (approve && counterpartId) {
      const mirrorRef = adminDb
        .collection(cashCollectionPath(restaurantId, 'movements'))
        .doc() as DocumentReference;
      const mirror = buildMirrorMovement({ ...movement, ...patch }, mirrorRef.id);
      tx.create(mirrorRef, mirror);
      ctx.balances.apply(mirror.registerId, balanceDeltaOf(mirror), audit.at);
    }
    // El retiro pendiente no contaba; al aprobarse sale de la caja del turno
    if (approve) ctx.balances.apply(movement.registerId, balanceDeltaOf(movement), audit.at);
    writeAuditLog(tx, restaurantId, {
      action: approve ? 'cash.withdrawal.approved' : 'cash.withdrawal.rejected',
      entityType: 'cashMovement',
      entityId: movementId,
      context: decisionAudit,
      data: { amount: movement.amount, receiptNumber: movement.receiptNumber },
    });
    const result: CashMovement = { ...movement, ...patch };
    idem.save(tx, result);
    return result;
  });
}

export interface ReverseMovementInput {
  reason: string;
}

/** Reverso: movimiento de sentido contrario en el mismo turno + contra-asiento del original. */
export async function reverseMovement(
  restaurantId: string,
  movementId: string,
  input: ReverseMovementInput,
  meta: MutationMeta
): Promise<CashMovement> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CashMovement>(tx, {
      restaurantId,
      scope: `cash.movement.reverse:${movementId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    const original = await readMovement(ctx, movementId);
    const shift = original.shiftId ? await ctx.shiftOf(original.shiftId) : null;
    assertReversible(original, shift);

    const prepared = await prepareRegisterMovement(
      {
        ...ctx,
        audit: {
          ...audit,
          registerId: original.registerId,
          shiftId: original.shiftId ?? undefined,
        },
      },
      {
        type: 'REVERSO',
        amount: original.amount,
        methodType: original.methodType,
        paymentMethodId: original.paymentMethodId,
        registerId: original.registerId,
        shiftId: original.shiftId,
        counterpartRegisterId: original.counterpartRegisterId,
        orderId: original.orderId,
        reason: input.reason,
        reverses: original,
      }
    );
    const movement = prepared.commit(tx);
    idem.save(tx, movement);
    return movement;
  });
}
