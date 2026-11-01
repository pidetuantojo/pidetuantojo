import { isValidAccountingDate, toAccountingDate } from '@/lib/shared/bogotaDate';
import type { Money } from '@/lib/shared/money';

import type {
  AttachmentKind,
  PettyExpense,
  PettyExpenseStatus,
  ReimbursementRow,
  ReimbursementStatus,
} from '../types/cash.petty.types';

import type { FormErrors } from './cash-forms.helpers';

export const EXPENSE_STATUS_LABELS: Record<PettyExpenseStatus, string> = {
  PENDIENTE: 'Pendiente',
  LEGALIZADO: 'Legalizado',
  REEMBOLSADO: 'Reembolsado',
  ANULADO: 'Anulado',
};

export const REIMBURSEMENT_STATUS_LABELS: Record<ReimbursementStatus, string> = {
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
};

export const MAX_ATTACHMENTS = 5;

export interface ExpenseDraft {
  amount: Money | null;
  maxExpense: number;
  concept: string;
  thirdPartyName: string;
  thirdPartyDocument: string;
  categoryId: string;
  date: string;
}

export function validateExpense(draft: ExpenseDraft) {
  const errors: FormErrors = {
    amount:
      draft.amount === null || draft.amount <= 0
        ? 'Ingresá un monto mayor a cero'
        : draft.maxExpense > 0 && draft.amount > draft.maxExpense
          ? 'El monto supera el máximo por gasto de esta caja'
          : undefined,
    concept: draft.concept.trim().length < 3 ? 'Escribí el concepto' : undefined,
    thirdPartyName:
      draft.thirdPartyName.trim().length < 2 ? 'Escribí el nombre del tercero' : undefined,
    thirdPartyDocument:
      draft.thirdPartyDocument.trim() && draft.thirdPartyDocument.trim().length < 3
        ? 'Documento demasiado corto'
        : undefined,
    categoryId: draft.categoryId ? undefined : 'Elegí la categoría',
    date: isValidAccountingDate(draft.date) ? undefined : 'Elegí una fecha válida',
  };
  return { errors, valid: !Object.values(errors).some(Boolean) };
}

/** Hoy en Bogotá (YYYY-MM-DD). */
export const todayBogota = (): string => toAccountingDate(new Date());

/** El tipo de adjunto sale del MIME del archivo; el servidor valida los bytes reales. */
export function attachmentKindOf(mime: string): AttachmentKind | null {
  if (mime === 'application/pdf') return 'pdf';
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mime) ? 'image' : null;
}

/** Gastos que se pueden meter en un reembolso: legalizados y sin otro reembolso activo. */
export const selectableForReimbursement = (expenses: readonly PettyExpense[]) =>
  expenses.filter((e) => e.status === 'LEGALIZADO' && !e.reimbursementId);

/** Un gasto admite adjuntar/anular solo si no está cerrado ni dentro de un reembolso. */
export const isExpenseOpen = (e: Pick<PettyExpense, 'status' | 'reimbursementId'>) =>
  (e.status === 'PENDIENTE' || e.status === 'LEGALIZADO') && !e.reimbursementId;

export const sumSelected = (expenses: readonly PettyExpense[], ids: ReadonlySet<string>): Money =>
  expenses.filter((e) => ids.has(e.id)).reduce((total, e) => total + e.amount, 0);

/** Aprobar/rechazar solo si está pendiente y, para aprobar, quien decide no es quien lo pidió. */
export function canApproveReimbursement(
  reimbursement: Pick<ReimbursementRow, 'status' | 'requestedBy'>,
  uid: string | undefined,
  hasApprovePermission: boolean
): boolean {
  return (
    hasApprovePermission &&
    reimbursement.status === 'PENDIENTE_APROBACION' &&
    !!uid &&
    reimbursement.requestedBy !== uid
  );
}

export interface FundDraft {
  target: Money | null;
  sourceKind: 'GENERAL' | 'BANK';
  generalId: string;
  bankAccountId: string;
  maxExpense: number;
}

export function validateFund(draft: FundDraft) {
  const errors: FormErrors = {
    target:
      draft.target === null || draft.target <= 0
        ? 'Ingresá el fondo'
        : draft.target < draft.maxExpense
          ? 'El fondo no puede ser menor al máximo por gasto'
          : undefined,
    source:
      draft.sourceKind === 'GENERAL'
        ? draft.generalId
          ? undefined
          : 'Elegí la caja general'
        : draft.bankAccountId
          ? undefined
          : 'Elegí la cuenta bancaria',
  };
  return { errors, valid: !Object.values(errors).some(Boolean) };
}

export interface PettyRegisterDraft {
  isPetty: boolean;
  fundAmount: Money | null;
  maxExpense: Money | null;
}

/** Caja menor: fondo > 0 y 0 < gasto máximo <= fondo. Otros tipos no validan nada. */
export function validatePettyRegister(draft: PettyRegisterDraft) {
  if (!draft.isPetty) return { errors: {} as FormErrors, valid: true };
  const errors: FormErrors = {
    fundAmount:
      draft.fundAmount === null || draft.fundAmount <= 0 ? 'Ingresá el fondo fijo' : undefined,
    maxExpense:
      draft.maxExpense === null || draft.maxExpense <= 0
        ? 'Ingresá el máximo por gasto'
        : draft.fundAmount !== null && draft.maxExpense > draft.fundAmount
          ? 'No puede superar el fondo'
          : undefined,
  };
  return { errors, valid: !Object.values(errors).some(Boolean) };
}
