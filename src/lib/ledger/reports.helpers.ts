// Funciones puras de los reportes: signo por naturaleza, saldo acumulado y totales.
import type { Money } from '@/lib/shared/money';

import { LedgerError } from './ledger.errors';
import type { AccountNature, JournalLine, LedgerAccount } from './ledger.types';
import type { LedgerReportLine, TrialBalanceReport, TrialBalanceRow } from './reports.types';

export const LEDGER_LINE_CAP = 2000;
export const JOURNAL_MAX_LIMIT = 200;
export const JOURNAL_DEFAULT_LIMIT = 50;

/** Efecto de una línea sobre el saldo: DEBITO → D−C, CREDITO → C−D. */
export function signedAmount(nature: AccountNature, debit: Money, credit: Money): Money {
  return nature === 'DEBITO' ? debit - credit : credit - debit;
}

type LineAmounts = Pick<JournalLine, 'debit' | 'credit'>;

export function sumLines(lines: readonly LineAmounts[]): { debit: Money; credit: Money } {
  return lines.reduce((t, l) => ({ debit: t.debit + l.debit, credit: t.credit + l.credit }), {
    debit: 0,
    credit: 0,
  });
}

/** Orden estable del mayor: fecha contable y luego número de asiento. */
export function sortLedgerLines<
  T extends Pick<JournalLine, 'accountingDate' | 'entryNumber' | 'id'>,
>(lines: readonly T[]): T[] {
  return [...lines].sort(
    (a, b) =>
      a.accountingDate.localeCompare(b.accountingDate) ||
      a.entryNumber.localeCompare(b.entryNumber) ||
      a.id.localeCompare(b.id)
  );
}

export function withRunningBalance(
  opening: Money,
  nature: AccountNature,
  lines: readonly JournalLine[]
): LedgerReportLine[] {
  let balance = opening;
  return lines.map((line) => {
    balance += signedAmount(nature, line.debit, line.credit);
    return { ...line, balance };
  });
}

export function closingBalance(
  opening: Money,
  nature: AccountNature,
  totals: { debit: Money; credit: Money }
): Money {
  return opening + signedAmount(nature, totals.debit, totals.credit);
}

export interface AccountSums {
  /** Σ débito y crédito de las líneas anteriores al inicio del rango. */
  before: { debit: Money; credit: Money };
  period: { debit: Money; credit: Money };
}

export function buildTrialBalanceRow(account: LedgerAccount, sums: AccountSums): TrialBalanceRow {
  const openingNet = sums.before.debit - sums.before.credit;
  const closingNet = openingNet + sums.period.debit - sums.period.credit;
  const sign = account.nature === 'DEBITO' ? 1 : -1;
  return {
    accountId: account.id,
    code: account.code,
    name: account.name,
    nature: account.nature,
    opening: openingNet * sign,
    debit: sums.period.debit,
    credit: sums.period.credit,
    closing: closingNet * sign,
    openingNet,
    closingNet,
  };
}

export function buildTrialBalance(
  range: { from: string; to: string },
  rows: readonly TrialBalanceRow[]
): TrialBalanceReport {
  const sorted = [...rows].sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit = sorted.reduce((t, r) => t + r.debit, 0);
  const totalCredit = sorted.reduce((t, r) => t + r.credit, 0);
  return {
    ...range,
    rows: sorted,
    totalDebit,
    totalCredit,
    totalOpeningNet: sorted.reduce((t, r) => t + r.openingNet, 0),
    totalClosingNet: sorted.reduce((t, r) => t + r.closingNet, 0),
    balanced: totalDebit === totalCredit,
  };
}

export function encodeCursor(accountingDate: string, sequence: number): string {
  return Buffer.from(JSON.stringify([accountingDate, sequence])).toString('base64url');
}

export function decodeCursor(cursor: string): [string, number] {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'number'
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // cae al error de abajo
  }
  throw new LedgerError('INVALID_CURSOR', 'El cursor de paginación es inválido');
}
