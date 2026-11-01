import type {
  AccountingRule,
  CreateAccountInput,
  JournalEntry,
  JournalReport,
  LedgerAccount,
  LedgerReport,
  TrialBalanceReport,
  UpdateAccountInput,
  UpdateRuleInput,
} from '../types/ledger.types';

import { request } from './ledger.http';

const enc = encodeURIComponent;
const range = (from: string, to: string) => `from=${enc(from)}&to=${enc(to)}`;

export interface LedgerSetupResult {
  created: boolean;
  accounts: number;
  rules: number;
}

/** Libro contable: plan de cuentas, reglas, asientos y reportes. */
export const ledgerApi = {
  createAccount: (input: CreateAccountInput, idempotencyKey: string) =>
    request<LedgerAccount>('/api/ledger/accounts', { method: 'POST', body: input, idempotencyKey }),

  updateAccount: (accountId: string, patch: UpdateAccountInput, idempotencyKey: string) =>
    request<LedgerAccount>(`/api/ledger/accounts/${enc(accountId)}`, {
      method: 'PATCH',
      body: patch,
      idempotencyKey,
    }),

  setup: (idempotencyKey: string) =>
    request<LedgerSetupResult>('/api/ledger/setup', { method: 'POST', body: {}, idempotencyKey }),

  listRules: async () => (await request<{ rules: AccountingRule[] }>('/api/ledger/rules')).rules,

  updateRule: (ruleId: string, input: UpdateRuleInput, idempotencyKey: string) =>
    request<AccountingRule>(`/api/ledger/rules/${enc(ruleId)}`, {
      method: 'PUT',
      body: input,
      idempotencyKey,
    }),

  deactivateRule: (ruleId: string, idempotencyKey: string) =>
    request<AccountingRule>(`/api/ledger/rules/${enc(ruleId)}/deactivate`, {
      method: 'POST',
      body: {},
      idempotencyKey,
    }),

  reverseEntry: (entryId: string, reason: string, idempotencyKey: string) =>
    request<JournalEntry>(`/api/ledger/entries/${enc(entryId)}/reverse`, {
      method: 'POST',
      body: { reason },
      idempotencyKey,
    }),

  getJournal: (from: string, to: string, cursor?: string, limit = 50) =>
    request<JournalReport>(
      `/api/ledger/journal?${range(from, to)}&limit=${limit}${cursor ? `&cursor=${enc(cursor)}` : ''}`
    ),

  getLedger: (accountId: string, from: string, to: string) =>
    request<LedgerReport>(`/api/ledger/ledger?accountId=${enc(accountId)}&${range(from, to)}`),

  getTrialBalance: (from: string, to: string) =>
    request<TrialBalanceReport>(`/api/ledger/trial-balance?${range(from, to)}`),
};
