'use client';

import { useState } from 'react';

import { MoneyInput } from '@/features/cash/components/MoneyInput';
import { reasonError, REASON_MAX } from '@/features/cash/helpers/reason.helpers';
import { useCashOrderActions } from '@/features/cash/hooks/useCashOrderActions';
import {
  getActivePaymentMethods,
  getPaymentLabel,
} from '@/features/payment-methods/helpers/payment-methods.helpers';
import { refundableAmount } from '@/lib/cash/order-payments.helpers';
import { formatCurrency } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';

import { DialogButton, DrawerDialog } from '../OrderDrawer/ui';

import type { RefundDialogProps } from './OrderPayments.types';

export function RefundDialog({ order, paymentMethods, onClose }: RefundDialogProps) {
  const { refund, isPending } = useCashOrderActions();
  const showToast = useToastStore((s) => s.showToast);
  const methods = getActivePaymentMethods(paymentMethods);
  const refundable = refundableAmount(order);

  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const reasonProblem = reasonError(reason);
  const canSubmit = !!methodId && !!amount && amount <= refundable && !reasonProblem;

  // Nunca se acepta más de lo devolvible
  function handleAmount(value: number | null) {
    setAmount(value !== null && value > refundable ? refundable : value);
  }

  async function handleSubmit() {
    setTouched(true);
    if (!canSubmit || isPending || !amount) return;
    const result = await refund({
      orderId: order.id,
      paymentMethodId: methodId,
      amount,
      reason: reason.trim(),
    });
    if (!result) return;
    showToast('Devolución registrada');
    onClose();
  }

  return (
    <DrawerDialog
      title="Devolución"
      subtitle={`Pedido #${order.orderNumber} · Devolvible ${formatCurrency(refundable)}`}
      onClose={onClose}
      footer={
        <>
          <DialogButton tone="ghost" onClick={onClose}>
            Cancelar
          </DialogButton>
          <DialogButton tone="danger" onClick={handleSubmit} disabled={isPending || !canSubmit}>
            {isPending ? 'Devolviendo...' : `Devolver ${formatCurrency(amount ?? 0)}`}
          </DialogButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="refund-method"
            className="mb-1.5 block text-xs font-semibold text-[var(--t-text-2)]"
          >
            Medio de devolución
          </label>
          <select
            id="refund-method"
            value={methodId}
            onChange={(event) => setMethodId(event.target.value)}
            className="w-full rounded-xl border border-[var(--t-input-border)] bg-[var(--t-input-bg)] px-3 py-2 text-sm text-[var(--t-text-1)] outline-none"
          >
            {methods.map((method) => (
              <option key={method.id} value={method.id}>
                {getPaymentLabel(method)}
                {method.account ? ` · ${method.account}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <MoneyInput
            id="refund-amount"
            label="Valor a devolver"
            value={amount}
            onChange={handleAmount}
            placeholder={String(refundable)}
          />
          <p className="mt-1 text-[11px] text-[var(--t-text-4)]">
            Máximo {formatCurrency(refundable)} (pagos vigentes menos devoluciones previas).
          </p>
        </div>

        <div>
          <label
            htmlFor="refund-reason"
            className="mb-1.5 block text-xs font-semibold text-[var(--t-text-2)]"
          >
            Motivo
          </label>
          <textarea
            id="refund-reason"
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Ej: producto en mal estado"
            className="w-full resize-none rounded-xl border border-[var(--t-input-border)] bg-[var(--t-input-bg)] px-3 py-2 text-sm text-[var(--t-text-1)] outline-none focus:border-[#FF6A1A]"
          />
          {touched && reasonProblem && (
            <p role="alert" className="mt-1 text-xs text-red-500">
              {reasonProblem}
            </p>
          )}
        </div>
      </div>
    </DrawerDialog>
  );
}
