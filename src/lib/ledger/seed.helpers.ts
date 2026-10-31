// Convierte el seed (por código) en documentos con ids generados. Puro: el id lo inyecta quien llama.
import { LedgerError } from './ledger.errors';
import type { AccountingRule, AccountRef, LedgerAccount } from './ledger.types';
import { SEED_ACCOUNTS, SEED_RULES, type SeedRef } from './seed';

export interface SeedDocs {
  accounts: LedgerAccount[];
  rules: AccountingRule[];
}

export function buildSeedDocs(input: {
  newId: () => string;
  now: string;
  createdBy: string;
}): SeedDocs {
  const { newId, now, createdBy } = input;
  const accounts: LedgerAccount[] = SEED_ACCOUNTS.map((a) => ({
    id: newId(),
    code: a.code,
    name: a.name,
    class: a.class,
    nature: a.nature,
    ...(a.parentCode ? { parentCode: a.parentCode } : {}),
    isActive: true,
    allowsMovements: a.allowsMovements,
    needsAccountantReview: true,
    createdAt: now,
    updatedAt: now,
  }));
  const idByCode = new Map(accounts.map((a) => [a.code, a.id]));

  const toRef = (ref: SeedRef): AccountRef => {
    if (ref.kind !== 'fixed') return ref;
    const accountId = idByCode.get(ref.code);
    if (!accountId) throw new LedgerError('ACCOUNT_NOT_FOUND', `El seed referencia la cuenta ${ref.code}`);
    return { kind: 'fixed', accountId };
  };

  const rules: AccountingRule[] = SEED_RULES.map((r) => ({
    id: newId(),
    event: r.event,
    methodType: r.methodType,
    debit: toRef(r.debit),
    credit: toRef(r.credit),
    version: 1,
    isActive: true,
    createdAt: now,
    createdBy,
  }));
  return { accounts, rules };
}
