import type { AccountClass, CreateAccountInput, LedgerAccount } from '../types/ledger.types';

import { DEFAULT_NATURE } from './ledger-labels.helpers';

/** Profundidad según la cadena de padres declarada: 1105 → 0, 110505 (padre 1105) → 1. */
export function accountDepth(
  account: Pick<LedgerAccount, 'parentCode'>,
  byCode: ReadonlyMap<string, Pick<LedgerAccount, 'parentCode'>>
): number {
  let depth = 0;
  let parent = account.parentCode;
  while (parent && depth < 6) {
    depth += 1;
    parent = byCode.get(parent)?.parentCode;
  }
  return depth;
}

export interface AccountRowData {
  account: LedgerAccount;
  depth: number;
}

/** Lista ordenada por código con sangría según el padre. */
export function buildAccountRows(accounts: readonly LedgerAccount[]): AccountRowData[] {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  return [...accounts]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((account) => ({ account, depth: accountDepth(account, byCode) }));
}

export interface AccountFormValues {
  code: string;
  name: string;
  class: AccountClass;
  parentCode: string;
  allowsMovements: boolean;
}

export const EMPTY_ACCOUNT_FORM: AccountFormValues = {
  code: '',
  name: '',
  class: 'ACTIVO',
  parentCode: '',
  allowsMovements: true,
};

export function validateAccountForm(values: AccountFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^\d{1,10}$/.test(values.code)) errors.code = 'Entre 1 y 10 dígitos';
  if (values.name.trim().length < 2) errors.name = 'Escribí el nombre';
  return errors;
}

export function toCreateInput(values: AccountFormValues): CreateAccountInput {
  return {
    code: values.code,
    name: values.name.trim(),
    class: values.class,
    nature: DEFAULT_NATURE[values.class],
    allowsMovements: values.allowsMovements,
    ...(values.parentCode ? { parentCode: values.parentCode } : {}),
  };
}
