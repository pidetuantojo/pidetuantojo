// SOLO servidor: cierre de turno a ciegas. El cajero cuenta sin ver esperado ni diferencias; el
// servidor compara y decide: dentro del umbral cierra solo, fuera exige aprobación de un supervisor.
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { AuthError } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { stripUndefined } from '@/lib/ledger/ledger.paths';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { CashError } from './cash.errors';
import { cashCollectionPath, cashDocPath } from './cash.paths';
import type { CashClosing, CashMovement, CountMap, MoneyByMethod, ShiftStatus } from './cash.types';
import { compactCount, computeCountTotal } from './denominations.helpers';
import { prepareFinalizeClose } from './closing.finalize.server';
import { computeDifferences, computeExpectedByMethod } from './expected.helpers';
import { createMovementContext } from './movement.context.server';
import { assertTransition, decideClose } from './shift.helpers';

/** Lo único que recibe el cajero: sin esperado ni diferencias. */
export interface CloseAck {
  shiftId: string;
  status: ShiftStatus;
}

export interface SubmitCountInput {
  cashCount: CountMap;
  declaredByMethod?: MoneyByMethod;
  justification?: string;
}

export interface ApproveCloseInput {
  decision: 'APROBAR';
  note: string;
  shortageAccountId?: string;
}

async function shiftMovements(
  tx: Transaction,
  restaurantId: string,
  shiftId: string
): Promise<CashMovement[]> {
  const snap = await tx.get(
    adminDb
      .collection(cashCollectionPath(restaurantId, 'movements'))
      .where('shiftId', '==', shiftId)
  );
  return snap.docs.map((d) => ({ ...(d.data() as CashMovement), id: d.id }));
}

function assertNoPendingWithdrawals(movements: readonly CashMovement[]) {
  if (movements.some((m) => m.status === 'PENDIENTE_APROBACION')) {
    throw new CashError(
      'PENDING_WITHDRAWALS',
      'Hay retiros pendientes de aprobación: resuélvelos antes de cerrar'
    );
  }
}

/** El cajero (o un supervisor) inicia el cierre: desde aquí no se aceptan más movimientos. */
export async function startClose(
  restaurantId: string,
  shiftId: string,
  options: { canApprove: boolean },
  meta: MutationMeta
): Promise<CloseAck> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CloseAck>(tx, {
      restaurantId,
      scope: `cash.shift.start_close:${shiftId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: { shiftId },
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    const shift = await ctx.shiftOf(shiftId);
    if (shift.cashierUid !== audit.uid && !options.canApprove) {
      throw new AuthError('Solo el cajero del turno o un supervisor puede iniciar el cierre', 403);
    }
    assertTransition(shift.status, 'EN_CIERRE');
    assertNoPendingWithdrawals(await shiftMovements(tx, restaurantId, shiftId));

    tx.update(adminDb.doc(cashDocPath(restaurantId, 'shifts', shiftId)) as DocumentReference, {
      status: 'EN_CIERRE',
      closeStartedAt: audit.at,
      closeStartedBy: audit.uid,
    });
    writeAuditLog(tx, restaurantId, {
      action: 'cash.shift.close_started',
      entityType: 'cashShift',
      entityId: shiftId,
      context: { ...audit, registerId: shift.registerId, shiftId },
    });
    const ack: CloseAck = { shiftId, status: 'EN_CIERRE' };
    idem.save(tx, ack);
    return ack;
  });
}

/** Conteo ciego del cajero. Responde solo `{ shiftId, status }`. */
export async function submitCount(
  restaurantId: string,
  shiftId: string,
  input: SubmitCountInput,
  meta: MutationMeta
): Promise<CloseAck> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CloseAck>(tx, {
      restaurantId,
      scope: `cash.shift.count:${shiftId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const baseCtx = await createMovementContext(tx, restaurantId, audit);
    const shift = await baseCtx.shiftOf(shiftId);
    if (shift.cashierUid !== audit.uid) {
      throw new AuthError('Solo el cajero del turno puede enviar el conteo', 403);
    }
    if (shift.status !== 'ABIERTO' && shift.status !== 'EN_CIERRE') {
      throw new CashError('INVALID_SHIFT_STATE', 'El turno no está listo para el conteo');
    }
    const ctx = { ...baseCtx, audit: { ...audit, registerId: shift.registerId, shiftId } };
    const register = await ctx.registerOf(shift.registerId);
    const movements = await shiftMovements(tx, restaurantId, shiftId);
    assertNoPendingWithdrawals(movements);

    const countedCash = computeCountTotal(input.cashCount, ctx.settings.denominations);
    const expectedByMethod = computeExpectedByMethod(movements);
    const declaredByMethod: MoneyByMethod = { ...input.declaredByMethod, efectivo: countedCash };
    const differenceByMethod = computeDifferences(expectedByMethod, declaredByMethod);
    const cashDifference = differenceByMethod.efectivo ?? 0;
    const decision = decideClose(cashDifference, register.diffThreshold);

    if (decision === 'APPROVAL' && !input.justification) {
      throw new CashError(
        'JUSTIFICATION_REQUIRED',
        'Para enviar este conteo debes agregar una justificación'
      );
    }

    const closing: CashClosing = stripUndefined({
      id: shiftId,
      shiftId,
      registerId: shift.registerId,
      cashierUid: shift.cashierUid,
      countSubmittedBy: audit.uid,
      countSubmittedAt: audit.at,
      cashCount: compactCount(input.cashCount),
      countedCash,
      expectedByMethod,
      declaredByMethod,
      differenceByMethod,
      cashDifference,
      diffThreshold: register.diffThreshold,
      justification: input.justification,
      status: 'PENDIENTE_APROBACION' as const,
    });

    let status: ShiftStatus;
    if (decision === 'AUTO') {
      const finalize = await prepareFinalizeClose({
        ctx,
        shift,
        register,
        closing,
        closingExists: false,
      });
      finalize.commit(tx);
      status = 'CERRADO';
    } else {
      assertTransition(shift.status, 'CERRADO_PENDIENTE_APROBACION');
      tx.create(
        adminDb.doc(cashDocPath(restaurantId, 'closings', shiftId)) as DocumentReference,
        closing
      );
      tx.update(adminDb.doc(cashDocPath(restaurantId, 'shifts', shiftId)) as DocumentReference, {
        status: 'CERRADO_PENDIENTE_APROBACION',
        closingId: shiftId,
        ...(shift.closeStartedAt ? {} : { closeStartedAt: audit.at, closeStartedBy: audit.uid }),
      });
      status = 'CERRADO_PENDIENTE_APROBACION';
    }
    writeAuditLog(tx, restaurantId, {
      action: 'cash.shift.count_submitted',
      entityType: 'cashShift',
      entityId: shiftId,
      context: ctx.audit,
      data: { status },
    });
    const ack: CloseAck = { shiftId, status };
    idem.save(tx, ack);
    return ack;
  });
}

/** Un supervisor distinto del cajero aprueba el cierre con diferencia y lo finaliza. */
export async function approveClose(
  restaurantId: string,
  shiftId: string,
  input: ApproveCloseInput,
  meta: MutationMeta
): Promise<CashClosing> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CashClosing>(tx, {
      restaurantId,
      scope: `cash.shift.approve:${shiftId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const baseCtx = await createMovementContext(tx, restaurantId, audit);
    const shift = await baseCtx.shiftOf(shiftId);
    if (shift.status !== 'CERRADO_PENDIENTE_APROBACION') {
      throw new CashError('INVALID_SHIFT_STATE', 'El turno no está pendiente de aprobación');
    }
    const closingSnap = await tx.get(
      adminDb.doc(cashDocPath(restaurantId, 'closings', shiftId)) as DocumentReference
    );
    if (!closingSnap.exists) throw new CashError('CLOSING_NOT_FOUND', 'El cierre no existe');
    const stored = { ...(closingSnap.data() as CashClosing), id: closingSnap.id };
    if (audit.uid === shift.cashierUid || audit.uid === stored.countSubmittedBy) {
      throw new AuthError('No puedes aprobar un cierre que tú mismo contaste', 403);
    }

    const ctx = { ...baseCtx, audit: { ...audit, registerId: shift.registerId, shiftId } };
    const register = await ctx.registerOf(shift.registerId);
    const finalize = await prepareFinalizeClose({
      ctx,
      shift,
      register,
      closing: stored,
      closingExists: true,
      shortageAccountId: input.shortageAccountId,
      approval: stripUndefined({
        approvedBy: audit.uid,
        approvedAt: audit.at,
        note: input.note,
        shortageAccountId: stored.cashDifference < 0 ? input.shortageAccountId : undefined,
      }),
    });
    finalize.commit(tx);
    writeAuditLog(tx, restaurantId, {
      action: 'cash.shift.close_approved',
      entityType: 'cashShift',
      entityId: shiftId,
      context: { ...ctx.audit, reason: input.note },
      data: { cashDifference: stored.cashDifference },
    });
    idem.save(tx, finalize.closing);
    return finalize.closing;
  });
}

/** Foto del cierre. Solo para supervisores (la ruta exige `cash.approve`). */
export async function getClosing(restaurantId: string, shiftId: string): Promise<CashClosing> {
  const snap = await adminDb.doc(cashDocPath(restaurantId, 'closings', shiftId)).get();
  if (!snap.exists) throw new CashError('CLOSING_NOT_FOUND', 'El cierre no existe');
  return { ...(snap.data() as CashClosing), id: snap.id };
}
