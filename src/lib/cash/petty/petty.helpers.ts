// Reglas puras de la caja menor: fondo fijo, transiciones de estado y totales.
import { sumMoney, type Money } from '@/lib/shared/money';

import type {
  PettyExpense,
  PettyExpenseStatus,
  PettyStatus,
  ReimbursementStatus,
} from './petty.types';

/**
 * Tope de gastos por reembolso. Cada gasto escribe asiento, 2 líneas, auditoría y su propio
 * documento (5 escrituras) y Firestore limita a 500 escrituras por transacción.
 */
export const MAX_REIMBURSEMENT_EXPENSES = 80;

/** Vales pendientes de reembolso: gastos no reembolsados y no anulados. */
export const OPEN_EXPENSE_STATUSES: readonly PettyExpenseStatus[] = ['PENDIENTE', 'LEGALIZADO'];

type AmountStatus = Pick<PettyExpense, 'amount' | 'status'>;

export const sumExpenses = (expenses: readonly Pick<PettyExpense, 'amount'>[]): Money =>
  sumMoney(expenses.map((e) => e.amount));

export const emptyCounts = (): Record<PettyExpenseStatus, number> => ({
  PENDIENTE: 0,
  LEGALIZADO: 0,
  REEMBOLSADO: 0,
  ANULADO: 0,
});

export function pendingVouchersTotal(expenses: readonly AmountStatus[]): Money {
  return sumExpenses(expenses.filter((e) => OPEN_EXPENSE_STATUSES.includes(e.status)));
}

export interface FundSnapshot {
  fundAmount: Money;
  constituted: boolean;
  maxExpense: Money;
  cashOnHand: Money;
  expenses: readonly AmountStatus[];
}

/** Invariante del fondo fijo: efectivo + vales pendientes = fondo (mientras esté constituido). */
export function isFundInvariantOk(
  s: Pick<FundSnapshot, 'fundAmount' | 'constituted' | 'cashOnHand' | 'expenses'>
): boolean {
  if (!s.constituted) return s.cashOnHand === 0 && pendingVouchersTotal(s.expenses) === 0;
  return s.cashOnHand + pendingVouchersTotal(s.expenses) === s.fundAmount;
}

export function buildPettyStatus(s: FundSnapshot): PettyStatus {
  const counts = emptyCounts();
  s.expenses.forEach((e) => (counts[e.status] += 1));
  return {
    fundAmount: s.fundAmount,
    constituted: s.constituted,
    cashOnHand: s.cashOnHand,
    pendingVouchersTotal: pendingVouchersTotal(s.expenses),
    invariantOk: isFundInvariantOk(s),
    counts,
    maxExpense: s.maxExpense,
  };
}

/** Fondo vigente (lo que realmente hay entre efectivo y vales); 0 si aún no se constituyó. */
export const currentFund = (cashOnHand: Money, expenses: readonly AmountStatus[]): Money =>
  cashOnHand + pendingVouchersTotal(expenses);

const EXPENSE_TRANSITIONS: Record<PettyExpenseStatus, readonly PettyExpenseStatus[]> = {
  PENDIENTE: ['LEGALIZADO', 'ANULADO'],
  LEGALIZADO: ['REEMBOLSADO', 'ANULADO'],
  REEMBOLSADO: [],
  ANULADO: [],
};

export const canTransitionExpense = (from: PettyExpenseStatus, to: PettyExpenseStatus) =>
  EXPENSE_TRANSITIONS[from].includes(to);

const REIMBURSEMENT_TRANSITIONS: Record<ReimbursementStatus, readonly ReimbursementStatus[]> = {
  PENDIENTE_APROBACION: ['APROBADO', 'RECHAZADO'],
  APROBADO: [],
  RECHAZADO: [],
};

export const canTransitionReimbursement = (from: ReimbursementStatus, to: ReimbursementStatus) =>
  REIMBURSEMENT_TRANSITIONS[from].includes(to);

/** Un gasto solo cambia (adjuntos, anulación) si no está en un reembolso activo ni cerrado. */
export const isExpenseEditable = (e: Pick<PettyExpense, 'status' | 'reimbursementId'>) =>
  (e.status === 'PENDIENTE' || e.status === 'LEGALIZADO') && !e.reimbursementId;
