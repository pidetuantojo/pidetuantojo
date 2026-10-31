// Tipos del libro contable (partida doble). Dinero = pesos COP enteros.
import type { AuditContext } from '@/lib/shared/audit.server';
import type { Money } from '@/lib/shared/money';
import type { PaymentMethodType } from '@/types';

export type AccountClass = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO';
export type AccountNature = 'DEBITO' | 'CREDITO';

export interface LedgerAccount {
  id: string;
  /** Solo dígitos (1–10). Inmutable. */
  code: string;
  name: string;
  class: AccountClass;
  nature: AccountNature;
  parentCode?: string;
  isActive: boolean;
  /** false = cuenta de agrupación: no recibe asientos. */
  allowsMovements: boolean;
  needsAccountantReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AccountingEvent =
  | 'SALE'
  | 'REFUND'
  | 'OTHER_INCOME'
  | 'EXPENSE'
  | 'CASH_TRANSFER'
  | 'BANK_DEPOSIT'
  | 'CASH_SURPLUS'
  | 'CASH_SHORTAGE'
  | 'PETTY_CASH_EXPENSE'
  | 'PETTY_CASH_REPLENISH'
  | 'GATEWAY_SETTLEMENT';

export const ACCOUNTING_EVENTS: readonly AccountingEvent[] = [
  'SALE',
  'REFUND',
  'OTHER_INCOME',
  'EXPENSE',
  'CASH_TRANSFER',
  'BANK_DEPOSIT',
  'CASH_SURPLUS',
  'CASH_SHORTAGE',
  'PETTY_CASH_EXPENSE',
  'PETTY_CASH_REPLENISH',
  'GATEWAY_SETTLEMENT',
];

/** Cómo una regla encuentra su cuenta sin amarrar cajas concretas. */
export type AccountRef =
  | { kind: 'fixed'; accountId: string }
  | { kind: 'sourceCashBox' }
  | { kind: 'targetCashBox' }
  | { kind: 'paymentMethod' }
  | { kind: 'expenseCategory' };

export interface ResolutionContext {
  sourceCashBoxAccountId?: string;
  targetCashBoxAccountId?: string;
  paymentMethodAccountId?: string;
  expenseCategoryAccountId?: string;
}

export interface AccountingRule {
  id: string;
  event: AccountingEvent;
  /** null = regla por defecto (cualquier medio de pago). */
  methodType: PaymentMethodType | null;
  debit: AccountRef;
  credit: AccountRef;
  version: number;
  isActive: boolean;
  supersededAt?: string;
  supersededBy?: string;
  createdAt: string;
  createdBy: string;
}

export interface JournalLineDraft {
  accountId: string;
  debit: Money;
  credit: Money;
  description?: string;
}

export interface JournalEntryDraft {
  /** YYYY-MM-DD (día contable de Bogotá). */
  accountingDate: string;
  event: AccountingEvent;
  description: string;
  sourceType: string;
  sourceId: string;
  lines: JournalLineDraft[];
  ruleId?: string;
  ruleVersion?: number;
  reversesEntryId?: string;
}

export interface JournalEntry extends JournalEntryDraft {
  id: string;
  /** Consecutivo formateado, p. ej. CC-000001. */
  number: string;
  sequence: number;
  totalDebit: Money;
  totalCredit: Money;
  /** Única mutación permitida sobre un asiento ya publicado. */
  reversedByEntryId?: string;
  audit: AuditContext;
  createdAt: string;
}

/** Línea aplanada para consultas por cuenta/fecha. Guarda copia de código y nombre. */
export interface JournalLine {
  id: string;
  entryId: string;
  entryNumber: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountingDate: string;
  debit: Money;
  credit: Money;
  event: AccountingEvent;
  sourceType: string;
  sourceId: string;
  createdAt: string;
}
