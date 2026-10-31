// Motor puro de partida doble: resolución de reglas, armado y validación de asientos.
import { isValidAccountingDate } from '@/lib/shared/bogotaDate';
import { isMoney, sumMoney, type Money } from '@/lib/shared/money';
import type { PaymentMethodType } from '@/types';

import { LedgerError } from './ledger.errors';
import type {
  AccountingEvent,
  AccountingRule,
  AccountRef,
  JournalEntry,
  JournalEntryDraft,
  JournalLineDraft,
  LedgerAccount,
  ResolutionContext,
} from './ledger.types';

export type AccountsById = ReadonlyMap<string, LedgerAccount>;

const isLive = (rule: AccountingRule) => rule.isActive && !rule.supersededAt;

/** Regla vigente del evento: la del medio de pago exacto gana sobre la genérica (null). */
export function resolveRule(
  rules: readonly AccountingRule[],
  event: AccountingEvent,
  methodType: PaymentMethodType | null
): AccountingRule {
  const candidates = rules.filter((r) => isLive(r) && r.event === event);
  const best =
    (methodType !== null ? candidates.find((r) => r.methodType === methodType) : undefined) ??
    candidates.find((r) => r.methodType === null);
  if (!best) {
    throw new LedgerError(
      'RULE_NOT_FOUND',
      `No hay regla contable para ${event}${methodType ? ` / ${methodType}` : ''}`
    );
  }
  return best;
}

const CONTEXT_FIELD = {
  sourceCashBox: 'sourceCashBoxAccountId',
  targetCashBox: 'targetCashBoxAccountId',
  paymentMethod: 'paymentMethodAccountId',
  expenseCategory: 'expenseCategoryAccountId',
} as const;

/** Convierte una referencia de la regla en un accountId concreto. */
export function resolveAccountRef(ref: AccountRef, context: ResolutionContext): string {
  if (ref.kind === 'fixed') return ref.accountId;
  const field = CONTEXT_FIELD[ref.kind];
  const accountId = context[field];
  if (!accountId) throw new LedgerError('MISSING_CONTEXT', `Falta ${field} para aplicar la regla`);
  return accountId;
}

export interface ValidateOptions {
  /** Reversiones: la cuenta debe existir pero puede haberse desactivado después. */
  allowInactive?: boolean;
}

function validateLine(
  line: JournalLineDraft,
  accountsById: AccountsById,
  options: ValidateOptions
) {
  if (!isMoney(line.debit) || !isMoney(line.credit)) {
    throw new LedgerError('INVALID_AMOUNT', 'Los montos deben ser pesos enteros');
  }
  if (line.debit < 0 || line.credit < 0) {
    throw new LedgerError('NEGATIVE_AMOUNT', 'Los montos no pueden ser negativos');
  }
  if (line.debit > 0 && line.credit > 0) {
    throw new LedgerError('BOTH_SIDES', 'Una línea no puede tener débito y crédito a la vez');
  }
  if (line.debit === 0 && line.credit === 0) {
    throw new LedgerError('ZERO_LINE', 'Una línea no puede tener monto cero');
  }
  const account = accountsById.get(line.accountId);
  if (!account) throw new LedgerError('ACCOUNT_NOT_FOUND', 'La cuenta no existe');
  if (options.allowInactive) return;
  if (!account.isActive) {
    throw new LedgerError('ACCOUNT_INACTIVE', `La cuenta ${account.code} está inactiva`);
  }
  if (!account.allowsMovements) {
    throw new LedgerError(
      'ACCOUNT_NOT_POSTABLE',
      `La cuenta ${account.code} no admite movimientos`
    );
  }
}

/** Valida un asiento completo (N líneas). Lanza `LedgerError` con el primer problema. */
export function validateEntry(
  draft: JournalEntryDraft,
  accountsById: AccountsById,
  options: ValidateOptions = {}
): void {
  if (!isValidAccountingDate(draft.accountingDate)) {
    throw new LedgerError('INVALID_DATE', 'La fecha contable es inválida');
  }
  if (draft.lines.length === 0) throw new LedgerError('EMPTY', 'El asiento no tiene líneas');
  draft.lines.forEach((line) => validateLine(line, accountsById, options));

  const totalDebit = sumMoney(draft.lines.map((l) => l.debit));
  const totalCredit = sumMoney(draft.lines.map((l) => l.credit));
  if (totalDebit !== totalCredit) {
    throw new LedgerError('UNBALANCED', `El asiento no cuadra (${totalDebit} vs ${totalCredit})`);
  }
}

export interface BuildEntryInput {
  rule: AccountingRule;
  amount: Money;
  context: ResolutionContext;
  accounts: AccountsById;
  accountingDate: string;
  description: string;
  sourceType: string;
  sourceId: string;
}

/** Arma y valida el asiento de 2 líneas que produce una regla. */
export function buildEntryFromRule(input: BuildEntryInput): JournalEntryDraft {
  const { rule, amount, context, accounts, accountingDate, description, sourceType, sourceId } =
    input;
  if (!isMoney(amount))
    throw new LedgerError('INVALID_AMOUNT', 'El monto debe ser en pesos enteros');
  if (amount < 0) throw new LedgerError('NEGATIVE_AMOUNT', 'El monto no puede ser negativo');
  if (amount === 0) throw new LedgerError('ZERO_LINE', 'El monto debe ser mayor a cero');

  const lines: JournalLineDraft[] = [
    { accountId: resolveAccountRef(rule.debit, context), debit: amount, credit: 0 },
    { accountId: resolveAccountRef(rule.credit, context), debit: 0, credit: amount },
  ];
  const draft: JournalEntryDraft = {
    accountingDate,
    event: rule.event,
    description,
    sourceType,
    sourceId,
    lines,
    ruleId: rule.id,
    ruleVersion: rule.version,
  };
  validateEntry(draft, accounts);
  return draft;
}

export type ReversibleEntry = Pick<
  JournalEntry,
  | 'id'
  | 'number'
  | 'event'
  | 'sourceType'
  | 'sourceId'
  | 'lines'
  | 'reversedByEntryId'
  | 'reversesEntryId'
>;

/** Contra-asiento: mismas cuentas con débito y crédito intercambiados. */
export function buildReversalDraft(
  original: ReversibleEntry,
  meta: { accountingDate: string; reason: string }
): JournalEntryDraft {
  if (original.reversesEntryId) {
    throw new LedgerError('CANNOT_REVERSE_REVERSAL', 'Una reversión no se puede reversar');
  }
  if (original.reversedByEntryId) {
    throw new LedgerError('ALREADY_REVERSED', 'El asiento ya fue reversado');
  }
  return {
    accountingDate: meta.accountingDate,
    event: original.event,
    description: `Reversión de ${original.number}: ${meta.reason}`,
    sourceType: original.sourceType,
    sourceId: original.sourceId,
    reversesEntryId: original.id,
    lines: original.lines.map((l) => ({
      accountId: l.accountId,
      debit: l.credit,
      credit: l.debit,
      ...(l.description ? { description: l.description } : {}),
    })),
  };
}
