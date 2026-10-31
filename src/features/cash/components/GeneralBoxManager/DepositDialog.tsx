'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import type { Money } from '@/lib/shared/money';

import { accountLabel, bankAccounts } from '../../helpers/approvals.helpers';
import { validateDeposit } from '../../helpers/cash-forms.helpers';
import { useLedgerAccounts } from '../../hooks/useCashQueries';
import { useGeneralBoxActions } from '../../hooks/useGeneralBoxActions';
import { MoneyInput } from '../MoneyInput';

interface DepositDialogProps {
  restaurantId: string;
  registerId: string;
  onClose: () => void;
}

/** Consignar efectivo de la caja general a una cuenta bancaria. */
export function DepositDialog({ restaurantId, registerId, onClose }: DepositDialogProps) {
  const { deposit } = useGeneralBoxActions(restaurantId);
  const accounts = useLedgerAccounts(restaurantId);
  const [bankAccountId, setBankAccountId] = useState('');
  const [amount, setAmount] = useState<Money | null>(null);
  const [externalRef, setExternalRef] = useState('');
  const [touched, setTouched] = useState(false);
  const { errors, valid } = validateDeposit({ bankAccountId, amount, externalRef });

  async function submit() {
    setTouched(true);
    if (!valid || amount === null || deposit.isPending) return;
    const result = await deposit.run({
      registerId,
      bankAccountId,
      amount,
      externalRef: externalRef.trim(),
    });
    if (result.ok) onClose();
  }

  return (
    <Modal isOpen onClose={onClose} title="Consignar al banco" size="sm">
      <div className="space-y-4 p-6">
        <Select
          label="Cuenta bancaria"
          value={bankAccountId}
          onChange={setBankAccountId}
          error={touched ? errors.bankAccountId : undefined}
          hint={accounts.isError ? 'No tenés permiso para ver el plan de cuentas' : undefined}
          options={bankAccounts(accounts.data ?? []).map((a) => ({
            value: a.id,
            label: accountLabel(a),
          }))}
          searchable
        />
        <MoneyInput
          id="deposit-amount"
          label="Monto"
          value={amount}
          onChange={setAmount}
          error={touched ? errors.amount : undefined}
        />
        <Input
          label="Referencia de la consignación"
          value={externalRef}
          maxLength={80}
          onChange={(e) => setExternalRef(e.target.value)}
          error={touched ? errors.externalRef : undefined}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={deposit.isPending}>
            Consignar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
