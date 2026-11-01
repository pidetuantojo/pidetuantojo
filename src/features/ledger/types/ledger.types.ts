// Solo tipos del servidor (se borran al compilar): el cliente nunca importa código de Admin SDK.
import type {
  AccountClass,
  AccountingEvent,
  AccountingRule,
  AccountNature,
  AccountRef,
  JournalEntry,
  LedgerAccount,
} from '@/lib/ledger/ledger.types';
import type { JournalReport, LedgerReport, TrialBalanceReport } from '@/lib/ledger/reports.types';

export type {
  AccountClass,
  AccountingEvent,
  AccountingRule,
  AccountNature,
  AccountRef,
  JournalEntry,
  JournalReport,
  LedgerAccount,
  LedgerReport,
  TrialBalanceReport,
};

export interface CreateAccountInput {
  code: string;
  name: string;
  class: AccountClass;
  nature?: AccountNature;
  parentCode?: string;
  allowsMovements?: boolean;
  needsAccountantReview?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  isActive?: boolean;
  allowsMovements?: boolean;
  needsAccountantReview?: boolean;
}

export interface UpdateRuleInput {
  debit: AccountRef;
  credit: AccountRef;
}

export interface DateRangeValue {
  from: string;
  to: string;
}
