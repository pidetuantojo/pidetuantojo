'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import type { Money } from '@/lib/shared/money';

import { accountLabel, postableAccounts } from '../../helpers/approvals.helpers';
import { validateManualMovement } from '../../helpers/cash-forms.helpers';
import { REASON_MAX } from '../../helpers/reason.helpers';
import { useLedgerAccounts } from '../../hooks/useCashQueries';
import { useGeneralBoxActions } from '../../hooks/useGeneralBoxActions';
import { MoneyInput } from '../MoneyInput';

interface GeneralMovementDialogProps {
  restaurantId: string;
  registerId: string;
  type: 'INGRESO_VARIO' | 'EGRESO';
  /** Solo con `ledger.manage`: permite elegir la cuenta contrapartida. */
  canChooseCounterpart: boolean;
  onClose: () => void;
}

/** Ingreso o egreso en efectivo de la caja general (sin turno). */
export function GeneralMovementDialog({
  restaurantId,
  registerId,
  type,
  canChooseCounterpart,
  onClose,
}: GeneralMovementDialogProps) {
  const { movement } = useGeneralBoxActions(restaurantId);
  const accounts = useLedgerAccounts(restaurantId, canChooseCounterpart);
  const [amount, setAmount] = useState<Money | null>(null);
  const [reason, setReason] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [override, setOverride] = useState('');
  const [touched, setTouched] = useState(false);
  const { errors, valid } = validateManualMovement({ amount, reason });

  async function submit() {
    setTouched(true);
    if (!valid || amount === null || movement.isPending) return;
    const result = await movement.run({
      registerId,
      input: {
        type,
        amount,
        reason: reason.trim(),
        ...(externalRef.trim() ? { externalRef: externalRef.trim() } : {}),
        ...(override ? { accountOverrideId: override } : {}),
      },
    });
    if (result.ok) onClose();
  }

  return (
    <Modal isOpen onClose={onClose} title={type === 'EGRESO' ? 'Egreso' : 'Ingreso'} size="sm">
      <div className="space-y-4 p-6">
        <MoneyInput
          id="general-amount"
          label="Monto"
          value={amount}
          onChange={setAmount}
          error={touched ? errors.amount : undefined}
          autoFocus
        />
        <Textarea
          label="Motivo"
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={touched ? errors.reason : undefined}
        />
        <Input
          label="Referencia (opcional)"
          value={externalRef}
          maxLength={80}
          onChange={(e) => setExternalRef(e.target.value)}
        />
        {canChooseCounterpart && (
          <Select
            label="Cuenta contrapartida (opcional)"
            value={override}
            onChange={setOverride}
            placeholder="Usar la cuenta por defecto"
            hint="Sirve para cargar el saldo inicial: elegí la cuenta de patrimonio o de aportes contra la que se registra."
            options={postableAccounts(accounts.data ?? []).map((a) => ({
              value: a.id,
              label: accountLabel(a),
            }))}
            searchable
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={movement.isPending}>
            Registrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
