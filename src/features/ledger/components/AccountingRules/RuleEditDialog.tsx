'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { CashNotice } from '@/features/cash/components/CashLayout';

import { ledgerErrorMessage } from '../../helpers/ledger-errors.helpers';
import {
  accountText,
  EVENT_LABELS,
  METHOD_LABELS,
  REF_KINDS,
} from '../../helpers/ledger-labels.helpers';
import { buildRef, isRefComplete, refAccountId } from '../../helpers/rules.helpers';
import { useRuleActions } from '../../hooks/useLedgerActions';
import type { AccountingRule, AccountRef, LedgerAccount } from '../../types/ledger.types';

interface RuleEditDialogProps {
  rule: AccountingRule;
  accounts: readonly LedgerAccount[];
  onClose: () => void;
}

interface RefEditorProps {
  label: string;
  value: AccountRef;
  accountOptions: { value: string; label: string }[];
  onChange: (ref: AccountRef) => void;
}

function RefEditor({ label, value, accountOptions, onChange }: RefEditorProps) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--t-border)] p-3">
      <Select
        label={label}
        value={value.kind}
        onChange={(kind) => onChange(buildRef(kind as AccountRef['kind'], refAccountId(value)))}
        options={REF_KINDS.map((k) => ({ value: k.kind, label: k.label }))}
      />
      {value.kind === 'fixed' && (
        <Select
          label="Cuenta"
          value={refAccountId(value)}
          onChange={(accountId) => onChange(buildRef('fixed', accountId))}
          options={accountOptions}
          placeholder="Elegí una cuenta"
          searchable
        />
      )}
    </div>
  );
}

/** Editar una regla crea una versión nueva: los asientos ya publicados no cambian. */
export function RuleEditDialog({ rule, accounts, onClose }: RuleEditDialogProps) {
  const { update } = useRuleActions();
  const [debit, setDebit] = useState<AccountRef>(rule.debit);
  const [credit, setCredit] = useState<AccountRef>(rule.credit);
  const [error, setError] = useState<string | null>(null);

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.isActive && a.allowsMovements)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((a) => ({ value: a.id, label: accountText(a) })),
    [accounts]
  );
  const complete = isRefComplete(debit) && isRefComplete(credit);

  async function submit() {
    if (!complete || update.isPending) return;
    setError(null);
    const result = await update.run({ ruleId: rule.id, rule: { debit, credit } });
    if (result.ok) onClose();
    else setError(ledgerErrorMessage(result.error));
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Editar regla: ${EVENT_LABELS[rule.event]}`}
      description={`${rule.methodType ? METHOD_LABELS[rule.methodType] : 'Cualquier medio de pago'} · versión ${rule.version}`}
      size="md"
    >
      <div className="space-y-4 p-6">
        <CashNotice>
          Guardar crea una versión nueva. Los asientos ya publicados conservan las cuentas con las
          que se hicieron.
        </CashNotice>
        {error && <CashNotice tone="danger">{error}</CashNotice>}
        <RefEditor
          label="Débito"
          value={debit}
          accountOptions={accountOptions}
          onChange={setDebit}
        />
        <RefEditor
          label="Crédito"
          value={credit}
          accountOptions={accountOptions}
          onChange={setCredit}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={update.isPending} disabled={!complete}>
            Guardar nueva versión
          </Button>
        </div>
      </div>
    </Modal>
  );
}
