'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import type { Money } from '@/lib/shared/money';

import { accountLabel, postableAccounts } from '../../helpers/approvals.helpers';
import { validateRegister } from '../../helpers/cash-forms.helpers';
import { useCashConfigActions } from '../../hooks/useCashConfigActions';
import type { CashRegister, LedgerAccount, RegisterType } from '../../types/cash.types';
import { MoneyInput } from '../MoneyInput';

const TYPE_OPTIONS: { value: RegisterType; label: string }[] = [
  { value: 'REGISTRADORA', label: 'Registradora (turnos de cajero)' },
  { value: 'GENERAL', label: 'General (saldo del negocio)' },
];

interface RegisterFormDialogProps {
  restaurantId: string;
  /** Si viene, se edita; si no, se crea. */
  register?: CashRegister;
  accounts: readonly LedgerAccount[];
  onClose: () => void;
}

/** Crear o editar una caja. El tipo no se puede cambiar después de creada. */
export function RegisterFormDialog({
  restaurantId,
  register,
  accounts,
  onClose,
}: RegisterFormDialogProps) {
  const { createRegister, updateRegister } = useCashConfigActions(restaurantId);
  const [type, setType] = useState<RegisterType>(register?.type ?? 'REGISTRADORA');
  const [name, setName] = useState(register?.name ?? '');
  const [ledgerAccountId, setLedgerAccountId] = useState(register?.ledgerAccountId ?? '');
  const [threshold, setThreshold] = useState<Money | null>(register?.diffThreshold ?? 0);
  const [touched, setTouched] = useState(false);
  const { errors, valid } = validateRegister({ name, ledgerAccountId });
  const cashAccounts = postableAccounts(accounts).filter((a) => a.class === 'ACTIVO');
  const pending = createRegister.isPending || updateRegister.isPending;

  async function submit() {
    setTouched(true);
    if (!valid || pending) return;
    const diffThreshold = threshold ?? 0;
    const result = register
      ? await updateRegister.run({
          registerId: register.id,
          input: { name: name.trim(), ledgerAccountId, diffThreshold },
        })
      : await createRegister.run({ type, name: name.trim(), ledgerAccountId, diffThreshold });
    if (result.ok) onClose();
  }

  return (
    <Modal isOpen onClose={onClose} title={register ? 'Editar caja' : 'Nueva caja'} size="sm">
      <div className="space-y-4 p-6">
        {!register && (
          <Select
            label="Tipo"
            value={type}
            onChange={(v) => setType(v as RegisterType)}
            options={TYPE_OPTIONS}
          />
        )}
        <Input
          label="Nombre"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          error={touched ? errors.name : undefined}
        />
        <Select
          label="Cuenta contable del efectivo"
          value={ledgerAccountId}
          onChange={setLedgerAccountId}
          error={touched ? errors.ledgerAccountId : undefined}
          options={cashAccounts.map((a) => ({ value: a.id, label: accountLabel(a) }))}
          searchable
        />
        {(register ? register.type : type) === 'REGISTRADORA' && (
          <MoneyInput
            id="register-threshold"
            label="Diferencia tolerada al cierre"
            value={threshold}
            onChange={setThreshold}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={pending}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
