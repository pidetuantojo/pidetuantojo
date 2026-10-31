// SOLO servidor: a qué caja y turno va un movimiento de quien cobra o devuelve.
// Efectivo → el turno ABIERTO propio (obligatorio). Electrónico → el turno propio si lo tiene;
// si no, la caja general por defecto, sin turno.
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import type { PaymentMethodType } from '@/types';

import { CashError } from './cash.errors';
import { cashDocPath, cashierLockId } from './cash.paths';
import type { CashShift } from './cash.types';
import type { MovementContext } from './movement.context.server';

/** Turno ABIERTO del usuario (a través de su candado), o null. Lectura dentro de la transacción. */
export async function resolveOpenShift(
  ctx: MovementContext,
  uid: string
): Promise<CashShift | null> {
  const lock = await ctx.tx.get(
    adminDb.doc(cashDocPath(ctx.restaurantId, 'locks', cashierLockId(uid))) as DocumentReference
  );
  if (!lock.exists) return null;
  const shift = await ctx.shiftOf((lock.data() as { shiftId: string }).shiftId);
  return shift.status === 'ABIERTO' ? shift : null;
}

export interface MovementTarget {
  registerId: string;
  shiftId: string | null;
}

export function resolveTarget(
  ctx: MovementContext,
  methodType: PaymentMethodType,
  shift: CashShift | null
): MovementTarget {
  if (shift) return { registerId: shift.registerId, shiftId: shift.id };
  if (methodType === 'efectivo') {
    throw new CashError('SHIFT_REQUIRED', 'Para recibir efectivo necesitas tu turno abierto');
  }
  const generalId = ctx.settings.defaultGeneralRegisterId;
  if (!generalId) {
    throw new CashError('NO_GENERAL_REGISTER', 'Configura la caja general en los ajustes de caja');
  }
  return { registerId: generalId, shiftId: null };
}
