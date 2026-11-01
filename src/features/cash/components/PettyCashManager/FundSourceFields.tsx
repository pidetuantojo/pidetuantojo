'use client';

import { Select } from '@/components/ui/Select';

import { accountLabel, bankAccounts, generalRegisters } from '../../helpers/approvals.helpers';
import type { FundSourceDraft, FundSourceKind } from '../../hooks/useFundSourceDraft';
import type { CashRegister, LedgerAccount } from '../../types/cash.types';

interface FundSourceFieldsProps {
  draft: FundSourceDraft;
  registers: readonly CashRegister[];
  accounts: readonly LedgerAccount[];
  accountsDenied?: boolean;
  error?: string;
  label?: string;
}

const KIND_OPTIONS: { value: FundSourceKind; label: string }[] = [
  { value: 'GENERAL', label: 'Caja general' },
  { value: 'BANK', label: 'Cuenta bancaria' },
];

/** De dónde sale (o a dónde vuelve) el dinero: caja general o cuenta bancaria. */
export function FundSourceFields({
  draft,
  registers,
  accounts,
  accountsDenied,
  error,
  label = 'Origen del dinero',
}: FundSourceFieldsProps) {
  return (
    <div className="space-y-3">
      <Select
        label={label}
        value={draft.kind}
        onChange={(v) => draft.setKind(v as FundSourceKind)}
        options={KIND_OPTIONS}
      />
      {draft.kind === 'GENERAL' ? (
        <Select
          label="Caja general"
          value={draft.generalId}
          onChange={draft.setGeneralId}
          error={error}
          options={generalRegisters(registers).map((r) => ({ value: r.id, label: r.name }))}
        />
      ) : (
        <Select
          label="Cuenta bancaria"
          value={draft.bankAccountId}
          onChange={draft.setBankAccountId}
          error={error}
          hint={accountsDenied ? 'No tenés permiso para ver el plan de cuentas' : undefined}
          options={bankAccounts(accounts).map((a) => ({ value: a.id, label: accountLabel(a) }))}
          searchable
        />
      )}
    </div>
  );
}
