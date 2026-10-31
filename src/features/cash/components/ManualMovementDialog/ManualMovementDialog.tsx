'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import {
  getActivePaymentMethods,
  getPaymentLabel,
} from '@/features/payment-methods/helpers/payment-methods.helpers';
import type { Money } from '@/lib/shared/money';

import { validateManualMovement } from '../../helpers/cash-forms.helpers';
import { REASON_MAX } from '../../helpers/reason.helpers';
import { movementTypeLabel } from '../../helpers/shift.helpers';
import { useShiftActions } from '../../hooks/useShiftActions';
import { MoneyInput } from '../MoneyInput';

import type { ManualMovementDialogProps } from './ManualMovementDialog.types';

/** Ingreso, egreso o retiro parcial del turno. El retiro queda pendiente de aprobación. */
export function ManualMovementDialog({
  type,
  restaurantId,
  shiftId,
  paymentMethods,
  onClose,
}: ManualMovementDialogProps) {
  const { move } = useShiftActions(restaurantId);
  const isWithdrawal = type === 'RETIRO_PARCIAL';
  // El retiro parcial es siempre de efectivo; ingresos y egresos pueden ser de cualquier medio
  const methods = getActivePaymentMethods(paymentMethods).filter(
    (m) => !isWithdrawal || m.type === 'efectivo'
  );
  const [methodId, setMethodId] = useState(
    () => methods.find((m) => m.type === 'efectivo')?.id ?? methods[0]?.id ?? ''
  );
  const [amount, setAmount] = useState<Money | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const { errors, valid } = validateManualMovement({ amount, reason });
  const method = methods.find((m) => m.id === methodId);

  async function submit() {
    setTouched(true);
    if (!valid || amount === null || move.isPending) return;
    const result = await move.run({
      shiftId,
      input: {
        type,
        amount,
        methodType: method?.type ?? 'efectivo',
        ...(method ? { paymentMethodId: method.id } : {}),
        reason: reason.trim(),
      },
    });
    if (result.ok) onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={movementTypeLabel(type)}
      description={isWithdrawal ? 'Quedará pendiente de aprobación de un supervisor.' : undefined}
      size="sm"
    >
      <div className="space-y-4 p-6">
        <MoneyInput
          id="movement-amount"
          label="Monto"
          value={amount}
          onChange={setAmount}
          error={touched ? errors.amount : undefined}
          autoFocus
        />
        {methods.length > 1 && (
          <Select
            label="Medio de pago"
            value={methodId}
            onChange={setMethodId}
            options={methods.map((m) => ({ value: m.id, label: getPaymentLabel(m) }))}
          />
        )}
        <Textarea
          label="Motivo"
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={touched ? errors.reason : undefined}
          placeholder="Ej: compra de hielo"
        />
        {isWithdrawal && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            Pendiente de aprobación
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={move.isPending}>
            Registrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
