// Tipos de los reportes contables (libro diario, mayor y balance de comprobación).
import type { Money } from '@/lib/shared/money';

import type { AccountNature, JournalEntry, JournalLine } from './ledger.types';

export interface JournalReport {
  entries: JournalEntry[];
  /** null cuando no hay más páginas. */
  nextCursor: string | null;
}

export interface LedgerReportLine extends JournalLine {
  /** Saldo acumulado con el signo propio de la naturaleza de la cuenta. */
  balance: Money;
}

export interface LedgerReport {
  account: { id: string; code: string; name: string; nature: AccountNature };
  from: string;
  to: string;
  openingBalance: Money;
  lines: LedgerReportLine[];
  totalDebit: Money;
  totalCredit: Money;
  closingBalance: Money;
  /** true si el rango tiene más de LEDGER_LINE_CAP líneas: se muestran solo las primeras. */
  truncated: boolean;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  nature: AccountNature;
  /** Saldos con el signo de la naturaleza de la cuenta. */
  opening: Money;
  debit: Money;
  credit: Money;
  closing: Money;
  /** Saldos netos débito − crédito (suman 0 sobre todas las cuentas). */
  openingNet: Money;
  closingNet: Money;
}

export interface TrialBalanceReport {
  from: string;
  to: string;
  rows: TrialBalanceRow[];
  totalDebit: Money;
  totalCredit: Money;
  totalOpeningNet: Money;
  totalClosingNet: Money;
  /** Σ débitos = Σ créditos del período. */
  balanced: boolean;
}
