import type { Money } from '@/lib/shared/money';
import { isValidAccountingDate } from '@/lib/shared/bogotaDate';

import { reasonError } from './reason.helpers';

export interface FormErrors {
  [field: string]: string | undefined;
}

const hasErrors = (errors: FormErrors) => Object.values(errors).some(Boolean);

const positiveAmountError = (amount: Money | null): string | undefined =>
  amount === null || amount <= 0 ? 'Ingresá un monto mayor a cero' : undefined;

const referenceError = (ref: string): string | undefined =>
  ref.trim().length === 0
    ? 'Escribí la referencia'
    : ref.trim().length > 80
      ? 'Máximo 80 caracteres'
      : undefined;

export interface ManualMovementDraft {
  amount: Money | null;
  reason: string;
}

export function validateManualMovement(draft: ManualMovementDraft) {
  const errors: FormErrors = {
    amount: positiveAmountError(draft.amount),
    reason: reasonError(draft.reason) ?? undefined,
  };
  return { errors, valid: !hasErrors(errors) };
}

export interface DepositDraft {
  bankAccountId: string;
  amount: Money | null;
  externalRef: string;
}

export function validateDeposit(draft: DepositDraft) {
  const errors: FormErrors = {
    bankAccountId: draft.bankAccountId ? undefined : 'Elegí la cuenta bancaria',
    amount: positiveAmountError(draft.amount),
    externalRef: referenceError(draft.externalRef),
  };
  return { errors, valid: !hasErrors(errors) };
}

export interface SettlementDraft extends DepositDraft {
  paymentMethodId: string;
  accountingDate: string;
}

export function validateSettlement(draft: SettlementDraft) {
  const errors: FormErrors = {
    ...validateDeposit(draft).errors,
    paymentMethodId: draft.paymentMethodId ? undefined : 'Elegí el medio de pago',
    accountingDate:
      draft.accountingDate && !isValidAccountingDate(draft.accountingDate)
        ? 'Fecha inválida'
        : undefined,
  };
  return { errors, valid: !hasErrors(errors) };
}

export interface RegisterDraft {
  name: string;
  ledgerAccountId: string;
}

export function validateRegister(draft: RegisterDraft) {
  const errors: FormErrors = {
    name: draft.name.trim().length < 2 ? 'Escribí el nombre (mínimo 2 caracteres)' : undefined,
    ledgerAccountId: draft.ledgerAccountId ? undefined : 'Elegí la cuenta contable',
  };
  return { errors, valid: !hasErrors(errors) };
}
