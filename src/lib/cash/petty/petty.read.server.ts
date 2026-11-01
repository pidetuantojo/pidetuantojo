// SOLO servidor: lecturas compartidas de la caja menor dentro de una transacción.
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { CashError } from '../cash.errors';
import type { CashRegister } from '../cash.types';
import type { MovementContext } from '../movement.context.server';
import { OPEN_EXPENSE_STATUSES } from './petty.helpers';
import { pettyCollectionPath, pettyDocPath } from './petty.paths';
import type { PettyCategory, PettyExpense, PettyReimbursement } from './petty.types';

/** La caja debe existir, estar activa y ser MENOR. */
export async function requirePettyRegister(
  ctx: MovementContext,
  registerId: string
): Promise<CashRegister> {
  const register = await ctx.registerOf(registerId);
  if (register.type !== 'MENOR' || !register.isActive) {
    throw new CashError('INVALID_REGISTER', 'La operación solo aplica a una caja menor activa');
  }
  return register;
}

export async function readExpense(
  tx: Transaction,
  restaurantId: string,
  expenseId: string
): Promise<PettyExpense> {
  const snap = await tx.get(
    adminDb.doc(pettyDocPath(restaurantId, 'expenses', expenseId)) as DocumentReference
  );
  if (!snap.exists) throw new CashError('PETTY_EXPENSE_NOT_FOUND', 'El gasto no existe');
  return { ...(snap.data() as PettyExpense), id: snap.id };
}

export async function readReimbursement(
  tx: Transaction,
  restaurantId: string,
  reimbursementId: string
): Promise<PettyReimbursement> {
  const snap = await tx.get(
    adminDb.doc(pettyDocPath(restaurantId, 'reimbursements', reimbursementId)) as DocumentReference
  );
  if (!snap.exists) throw new CashError('REIMBURSEMENT_NOT_FOUND', 'El reembolso no existe');
  return { ...(snap.data() as PettyReimbursement), id: snap.id };
}

export async function readCategory(
  tx: Transaction,
  restaurantId: string,
  categoryId: string
): Promise<PettyCategory> {
  const snap = await tx.get(
    adminDb.doc(pettyDocPath(restaurantId, 'categories', categoryId)) as DocumentReference
  );
  if (!snap.exists) throw new CashError('PETTY_CATEGORY_NOT_FOUND', 'La categoría no existe');
  return { ...(snap.data() as PettyCategory), id: snap.id };
}

/** Gastos de la caja aún no reembolsados ni anulados (vales pendientes). */
export async function readOpenExpenses(
  tx: Transaction,
  restaurantId: string,
  registerId: string
): Promise<PettyExpense[]> {
  const snap = await tx.get(
    adminDb
      .collection(pettyCollectionPath(restaurantId, 'expenses'))
      .where('registerId', '==', registerId)
      .where('status', 'in', [...OPEN_EXPENSE_STATUSES])
  );
  return snap.docs.map((d) => ({ ...(d.data() as PettyExpense), id: d.id }));
}
