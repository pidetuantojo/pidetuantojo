'use client';

import { useState } from 'react';

import { reasonError, REASON_MAX } from '@/features/cash/helpers/reason.helpers';
import { useCashOrderActions } from '@/features/cash/hooks/useCashOrderActions';
import { formatCurrency } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';

import { DialogButton, DrawerDialog } from '../OrderDrawer/ui';

import type { ReversePaymentDialogProps } from './OrderPayments.types';

export function ReversePaymentDialog({ order, payment, onClose }: ReversePaymentDialogProps) {
  const { reversePayment, isPending } = useCashOrderActions();
  const showToast = useToastStore((s) => s.showToast);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const error = reasonError(reason);

  async function handleSubmit() {
    setTouched(true);
    if (error || isPending) return;
    const result = await reversePayment({
      orderId: order.id,
      paymentId: payment.id,
      reason: reason.trim(),
    });
    if (!result) return;
    showToast('Pago reversado');
    onClose();
  }

  return (
    <DrawerDialog
      title="Reversar pago"
      subtitle={`Pedido #${order.orderNumber} · ${payment.method} ${formatCurrency(payment.amount)}`}
      onClose={onClose}
      footer={
        <>
          <DialogButton tone="ghost" onClick={onClose}>
            Cancelar
          </DialogButton>
          <DialogButton tone="danger" onClick={handleSubmit} disabled={isPending || !!error}>
            {isPending ? 'Reversando...' : 'Reversar pago'}
          </DialogButton>
        </>
      }
    >
      <label
        htmlFor="reverse-reason"
        className="mb-1.5 block text-xs font-semibold text-[var(--t-text-2)]"
      >
        Motivo del reverso
      </label>
      <textarea
        id="reverse-reason"
        rows={3}
        maxLength={REASON_MAX}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="Ej: cobro registrado por error"
        className="w-full resize-none rounded-xl border border-[var(--t-input-border)] bg-[var(--t-input-bg)] px-3 py-2 text-sm text-[var(--t-text-1)] outline-none focus:border-[#FF6A1A]"
      />
      {touched && error && (
        <p role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] text-[var(--t-text-4)]">
        El dinero sale de la caja del turno de este pago. Solo se puede reversar mientras ese turno
        siga abierto; después usá &quot;Devolución&quot;.
      </p>
    </DrawerDialog>
  );
}
