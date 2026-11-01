'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { CashNotice } from '@/features/cash/components/CashLayout';

import {
  EMPTY_ACCOUNT_FORM,
  toCreateInput,
  validateAccountForm,
  type AccountFormValues,
} from '../../helpers/accounts.helpers';
import { ledgerErrorMessage } from '../../helpers/ledger-errors.helpers';
import {
  ACCOUNT_CLASSES,
  accountText,
  CLASS_LABELS,
  DEFAULT_NATURE,
  NATURE_LABELS,
} from '../../helpers/ledger-labels.helpers';
import { useAccountActions } from '../../hooks/useLedgerActions';
import type { AccountClass, LedgerAccount } from '../../types/ledger.types';

interface AccountFormDialogProps {
  /** Sin cuenta = crear; con cuenta = editar nombre, estado y banderas. */
  account?: LedgerAccount;
  accounts: readonly LedgerAccount[];
  onClose: () => void;
}

const checkboxClass = 'flex items-center gap-2 text-sm text-[var(--t-text-1)]';

export function AccountFormDialog({ account, accounts, onClose }: AccountFormDialogProps) {
  const { create, update } = useAccountActions();
  const editing = Boolean(account);
  const [values, setValues] = useState<AccountFormValues>(
    account
      ? {
          code: account.code,
          name: account.name,
          class: account.class,
          parentCode: account.parentCode ?? '',
          allowsMovements: account.allowsMovements,
        }
      : EMPTY_ACCOUNT_FORM
  );
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [needsReview, setNeedsReview] = useState(account?.needsAccountantReview ?? false);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const errors = touched ? validateAccountForm(values) : {};
  const isPending = create.isPending || update.isPending;

  const set = <K extends keyof AccountFormValues>(key: K, value: AccountFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    setTouched(true);
    if (Object.keys(validateAccountForm(values)).length > 0 || isPending) return;
    setServerError(null);
    const result = account
      ? await update.run({
          accountId: account.id,
          patch: {
            name: values.name.trim(),
            isActive,
            allowsMovements: values.allowsMovements,
            needsAccountantReview: needsReview,
          },
        })
      : await create.run({ ...toCreateInput(values), needsAccountantReview: needsReview });
    if (result.ok) onClose();
    else setServerError(ledgerErrorMessage(result.error));
  }

  const parentOptions = [
    { value: '', label: 'Sin cuenta padre' },
    ...accounts.map((a) => ({ value: a.code, label: accountText(a) })),
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? 'Editar cuenta' : 'Nueva cuenta'}
      description={editing ? 'El código nunca cambia una vez creada.' : undefined}
      size="md"
    >
      <div className="space-y-4 p-6">
        {serverError && <CashNotice tone="danger">{serverError}</CashNotice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Código"
            inputMode="numeric"
            maxLength={10}
            value={values.code}
            disabled={editing}
            error={errors.code}
            onChange={(e) => set('code', e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="Nombre"
            value={values.name}
            error={errors.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        {!editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Clase"
              value={values.class}
              onChange={(v) => set('class', v as AccountClass)}
              options={ACCOUNT_CLASSES.map((c) => ({ value: c, label: CLASS_LABELS[c] }))}
              hint={`Naturaleza: ${NATURE_LABELS[DEFAULT_NATURE[values.class]]}`}
            />
            <Select
              label="Cuenta padre"
              value={values.parentCode}
              onChange={(v) => set('parentCode', v)}
              options={parentOptions}
              searchable
            />
          </div>
        )}
        <div className="space-y-2">
          <label className={checkboxClass}>
            <input
              type="checkbox"
              checked={values.allowsMovements}
              onChange={(e) => set('allowsMovements', e.target.checked)}
            />
            Admite movimientos (si no, es una cuenta de agrupación)
          </label>
          {editing && (
            <label className={checkboxClass}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Cuenta activa
            </label>
          )}
          <label className={checkboxClass}>
            <input
              type="checkbox"
              checked={needsReview}
              onChange={(e) => setNeedsReview(e.target.checked)}
            />
            Marcar como &quot;a validar por el contador&quot;
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={isPending}>
            {editing ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
