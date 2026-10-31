// SOLO servidor: cierre definitivo del turno (compartido por el conteo automático y la aprobación).
// Orden contable: ajuste por diferencia (si hay) → traslado del efectivo contado a la caja general.
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { CashError } from './cash.errors';
import { cashDocPath, cashierLockId, registerLockId } from './cash.paths';
import type { CashClosing, CashRegister, CashShift } from './cash.types';
import type { MovementContext } from './movement.context.server';
import { prepareRegisterMovement, type PreparedMovement } from './movement.server';
import { assertTransition } from './shift.helpers';

export interface FinalizeInput {
  ctx: MovementContext;
  shift: CashShift;
  register: CashRegister;
  closing: CashClosing;
  /** Si el cierre ya existía (aprobación) se actualiza; si no, se crea. */
  closingExists: boolean;
  shortageAccountId?: string;
  approval?: NonNullable<CashClosing['approval']>;
}

export interface PreparedFinalize {
  closing: CashClosing;
  commit: (tx: Transaction) => void;
}

/** Lectura: prepara ajuste y traslado. `commit` escribe todo, libera candados y cierra el turno. */
export async function prepareFinalizeClose(input: FinalizeInput): Promise<PreparedFinalize> {
  const { ctx, shift, register, shortageAccountId, approval } = input;
  const { restaurantId, audit } = ctx;
  assertTransition(shift.status, 'CERRADO');

  const { cashDifference, countedCash } = input.closing;
  const base = { registerId: shift.registerId, shiftId: shift.id, methodType: 'efectivo' as const };
  if (shortageAccountId && shortageAccountId === register.ledgerAccountId) {
    throw new CashError(
      'INVALID_LEDGER_ACCOUNT',
      'La cuenta del faltante no puede ser la misma caja que se está cerrando'
    );
  }

  let adjustment: PreparedMovement | null = null;
  if (cashDifference !== 0) {
    adjustment = await prepareRegisterMovement(ctx, {
      ...base,
      type: cashDifference > 0 ? 'AJUSTE_SOBRANTE' : 'AJUSTE_FALTANTE',
      amount: Math.abs(cashDifference),
      reason: 'Ajuste por diferencia de cierre',
      debitAccountOverrideId: cashDifference < 0 ? shortageAccountId : undefined,
    });
  }
  let transfer: PreparedMovement | null = null;
  if (countedCash > 0) {
    if (!ctx.settings.defaultGeneralRegisterId) {
      throw new CashError(
        'NO_GENERAL_REGISTER',
        'Configura la caja general en los ajustes de caja'
      );
    }
    transfer = await prepareRegisterMovement(ctx, {
      ...base,
      type: 'TRASLADO_CIERRE',
      amount: countedCash,
      counterpartRegisterId: ctx.settings.defaultGeneralRegisterId,
      reason: 'Traslado de cierre a caja general',
    });
  }

  const closing: CashClosing = {
    ...input.closing,
    status: 'CERRADO',
    ...(adjustment ? { adjustmentMovementId: adjustment.movement.id } : {}),
    ...(transfer ? { transferMovementId: transfer.movement.id } : {}),
    ...(approval ? { approval } : {}),
    closedAt: audit.at,
  };

  const commit = (tx: Transaction) => {
    adjustment?.commit(tx);
    transfer?.commit(tx);
    tx.delete(
      adminDb.doc(
        cashDocPath(restaurantId, 'locks', registerLockId(shift.registerId))
      ) as DocumentReference
    );
    tx.delete(
      adminDb.doc(
        cashDocPath(restaurantId, 'locks', cashierLockId(shift.cashierUid))
      ) as DocumentReference
    );
    tx.update(adminDb.doc(cashDocPath(restaurantId, 'shifts', shift.id)) as DocumentReference, {
      status: 'CERRADO',
      closedAt: audit.at,
      closingId: shift.id,
      ...(approval ? { approvedBy: approval.approvedBy } : {}),
    });
    const closingRef = adminDb.doc(
      cashDocPath(restaurantId, 'closings', shift.id)
    ) as DocumentReference;
    if (input.closingExists) tx.update(closingRef, { ...closing });
    else tx.create(closingRef, closing);
  };

  return { closing, commit };
}
