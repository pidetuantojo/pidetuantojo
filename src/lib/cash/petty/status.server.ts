// SOLO servidor: lecturas de la caja menor (estado del fondo, gastos y reembolsos).
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { CashError } from '../cash.errors';
import { cashDocPath } from '../cash.paths';
import type { CashRegister } from '../cash.types';
import { emptyBalanceDoc, type RegisterBalanceDoc } from '../register-balance.server';
import { buildPettyStatus } from './petty.helpers';
import { pettyCollectionPath } from './petty.paths';
import type {
  PettyExpense,
  PettyExpenseStatus,
  PettyReimbursement,
  PettyStatus,
  ReimbursementStatus,
} from './petty.types';

const LIST_LIMIT = 300;

const byNewest = <T extends { createdAt?: string; requestedAt?: string }>(a: T, b: T) =>
  (b.createdAt ?? b.requestedAt ?? '').localeCompare(a.createdAt ?? a.requestedAt ?? '');

/** Estado del fondo leído en una transacción de solo lectura (efectivo y vales coherentes). */
export async function getPettyStatus(
  restaurantId: string,
  registerId: string
): Promise<PettyStatus> {
  return adminDb.runTransaction(async (tx) => {
    const registerSnap = await tx.get(
      adminDb.doc(cashDocPath(restaurantId, 'registers', registerId)) as DocumentReference
    );
    const register = registerSnap.data() as CashRegister | undefined;
    if (!registerSnap.exists || !register || register.type !== 'MENOR') {
      throw new CashError('REGISTER_NOT_FOUND', 'La caja menor no existe');
    }
    const balanceSnap = await tx.get(
      adminDb.doc(cashDocPath(restaurantId, 'balances', registerId)) as DocumentReference
    );
    const balance: RegisterBalanceDoc = balanceSnap.exists
      ? { ...emptyBalanceDoc(), ...(balanceSnap.data() as Partial<RegisterBalanceDoc>) }
      : emptyBalanceDoc();
    const expensesSnap = await tx.get(
      adminDb
        .collection(pettyCollectionPath(restaurantId, 'expenses'))
        .where('registerId', '==', registerId)
    );
    return buildPettyStatus({
      fundAmount: register.fundAmount ?? 0,
      constituted: Boolean(register.fundConstitutedAt),
      maxExpense: register.maxExpense ?? 0,
      cashOnHand: balance.byMethod.efectivo ?? 0,
      expenses: expensesSnap.docs.map((d) => d.data() as PettyExpense),
    });
  });
}

export async function listExpenses(
  restaurantId: string,
  filter: { registerId: string; status?: PettyExpenseStatus }
): Promise<PettyExpense[]> {
  let query = adminDb
    .collection(pettyCollectionPath(restaurantId, 'expenses'))
    .where('registerId', '==', filter.registerId);
  if (filter.status) query = query.where('status', '==', filter.status);
  const snap = await query.orderBy('createdAt', 'desc').limit(LIST_LIMIT).get();
  return snap.docs.map((d) => ({ ...(d.data() as PettyExpense), id: d.id })).sort(byNewest);
}

export async function listReimbursements(
  restaurantId: string,
  filter: { registerId: string; status?: ReimbursementStatus }
): Promise<PettyReimbursement[]> {
  let query = adminDb
    .collection(pettyCollectionPath(restaurantId, 'reimbursements'))
    .where('registerId', '==', filter.registerId);
  if (filter.status) query = query.where('status', '==', filter.status);
  const snap = await query.orderBy('requestedAt', 'desc').limit(LIST_LIMIT).get();
  return snap.docs.map((d) => ({ ...(d.data() as PettyReimbursement), id: d.id })).sort(byNewest);
}
