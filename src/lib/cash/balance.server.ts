// SOLO servidor: saldos de cajas sin turno (general/menor) y listado de movimientos de un turno.
import type { Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { CashError } from './cash.errors';
import { cashCollectionPath, cashDocPath } from './cash.paths';
import type { CashMovement, CashRegister, CashShift, MoneyByMethod } from './cash.types';
import { computeExpectedByMethod, computeRegisterBalance } from './expected.helpers';

const toMovement = (d: { id: string; data: () => unknown }) =>
  ({ ...(d.data() as CashMovement), id: d.id }) as CashMovement;

/** Efectivo de la caja = Σ movimientos aplicados (incluye espejos). Lectura dentro de la transacción. */
export async function readCashBalance(
  tx: Transaction,
  restaurantId: string,
  registerId: string
): Promise<number> {
  const snap = await tx.get(
    adminDb
      .collection(cashCollectionPath(restaurantId, 'movements'))
      .where('registerId', '==', registerId)
      .where('methodType', '==', 'efectivo')
  );
  return computeRegisterBalance(snap.docs.map(toMovement)).efectivo ?? 0;
}

export interface RegisterBalance {
  registerId: string;
  balanceByMethod: MoneyByMethod;
  cash: number;
}

/** Saldo de una caja general (por medio). Solo para quien tiene `cash.approve`. */
export async function getRegisterBalance(
  restaurantId: string,
  registerId: string
): Promise<RegisterBalance> {
  const regSnap = await adminDb.doc(cashDocPath(restaurantId, 'registers', registerId)).get();
  if (!regSnap.exists) throw new CashError('REGISTER_NOT_FOUND', 'La caja no existe');
  if ((regSnap.data() as CashRegister).type !== 'GENERAL') {
    throw new CashError('INVALID_REGISTER', 'El saldo se consulta solo en cajas generales');
  }
  const snap = await adminDb
    .collection(cashCollectionPath(restaurantId, 'movements'))
    .where('registerId', '==', registerId)
    .get();
  const balanceByMethod = computeRegisterBalance(snap.docs.map(toMovement));
  return { registerId, balanceByMethod, cash: balanceByMethod.efectivo ?? 0 };
}

export interface ShiftMovementsView {
  movements: Omit<CashMovement, 'audit'>[];
  /** Solo para supervisores: el cajero nunca recibe totales (cierre a ciegas). */
  totalsByMethod?: MoneyByMethod;
}

export async function listShiftMovements(
  restaurantId: string,
  shiftId: string,
  viewer: { uid: string; canApprove: boolean }
): Promise<ShiftMovementsView> {
  const shiftSnap = await adminDb.doc(cashDocPath(restaurantId, 'shifts', shiftId)).get();
  if (!shiftSnap.exists) throw new CashError('SHIFT_NOT_FOUND', 'El turno no existe');
  const shift = shiftSnap.data() as CashShift;
  if (!viewer.canApprove && shift.cashierUid !== viewer.uid) {
    // Mismo error que "no existe": no se revela a otros cajeros
    throw new CashError('SHIFT_NOT_FOUND', 'El turno no existe');
  }
  const snap = await adminDb
    .collection(cashCollectionPath(restaurantId, 'movements'))
    .where('shiftId', '==', shiftId)
    .get();
  const all = snap.docs.map(toMovement).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const movements = all.map((m) => {
    const copy: Omit<CashMovement, 'audit'> & { audit?: unknown } = { ...m };
    delete copy.audit;
    return copy;
  });
  return viewer.canApprove
    ? { movements, totalsByMethod: computeExpectedByMethod(all) }
    : { movements };
}
