'use client';

import { useState } from 'react';
import { Check, RotateCcw, Undo2, XCircle } from 'lucide-react';

import { refundableAmount } from '@/lib/cash/order-payments.helpers';
import { formatCurrency } from '@/lib/utils';
import type { OrderPayment } from '@/types';

import { PAYMENT_METHOD_DEFINITIONS } from '@/features/payment-methods/constants/payment-methods.constants';

import { RefundDialog } from './RefundDialog';
import { ReversePaymentDialog } from './ReversePaymentDialog';
import type { OrderPaymentsListProps } from './OrderPayments.types';

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Pagos y devoluciones del pedido. Sin caja activa: la lista de siempre (con "Anular pago").
 * Con caja activa: reverso con motivo, pagos reversados tachados y devoluciones.
 */
export function OrderPaymentsList({
  order,
  paymentMethods,
  cashEnabled,
  canMarkPaid,
  canReverse,
  onRemoveLegacy,
}: OrderPaymentsListProps) {
  const [reversing, setReversing] = useState<OrderPayment | null>(null);
  const [refunding, setRefunding] = useState(false);
  const payments = order.payments ?? [];

  if (!cashEnabled) {
    return (
      <>
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-xs text-emerald-700">
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3" /> {p.method}
              {p.label ? ` · ${p.label}` : ''}
              {p.received && p.received > p.amount ? (
                <span className="text-[var(--t-text-4)]">
                  {' '}
                  (cambio {formatCurrency(p.received - p.amount)})
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-1">
              {formatCurrency(p.amount)}
              {canMarkPaid && (
                <button
                  type="button"
                  onClick={() => onRemoveLegacy(p.id)}
                  aria-label="Anular pago"
                  className="text-emerald-300 hover:text-red-500"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          </div>
        ))}
      </>
    );
  }

  const refunds = order.refunds ?? [];
  const canRefund = canReverse && refundableAmount(order) > 0;

  return (
    <>
      {payments.map((p) =>
        p.reversedAt ? (
          <div key={p.id} className="text-xs text-[var(--t-text-4)]" data-testid="reversed-payment">
            <div className="flex items-center justify-between line-through">
              <span>
                {p.method}
                {p.label ? ` · ${p.label}` : ''}
              </span>
              <span>{formatCurrency(p.amount)}</span>
            </div>
            <p className="text-[10px]">
              Reversado {formatWhen(p.reversedAt)}
              {p.reversedBy ? ` por ${p.reversedBy}` : ''}
              {p.reversalReason ? ` · ${p.reversalReason}` : ''}
            </p>
          </div>
        ) : (
          <div key={p.id} className="text-xs text-emerald-700">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" /> {p.method}
                {p.label ? ` · ${p.label}` : ''}
                {p.received && p.received > p.amount ? (
                  <span className="text-[var(--t-text-4)]">
                    {' '}
                    (cambio {formatCurrency(p.received - p.amount)})
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-1">
                {formatCurrency(p.amount)}
                {canReverse && p.movementId && (
                  <button
                    type="button"
                    onClick={() => setReversing(p)}
                    aria-label="Reversar pago"
                    title="Reversar pago"
                    className="text-emerald-300 hover:text-red-500"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </div>
            {canReverse && !p.movementId && (
              <p className="text-[10px] text-[var(--t-text-4)]">
                Pago anterior al módulo de caja: no se puede reversar, usá &quot;Devolución&quot;.
              </p>
            )}
          </div>
        )
      )}

      {refunds.map((r) => (
        <div key={r.id} className="text-xs text-red-600" data-testid="refund-row">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Undo2 className="h-3 w-3" /> Devolución ·{' '}
              {PAYMENT_METHOD_DEFINITIONS[r.methodType].label}
            </span>
            <span>−{formatCurrency(r.amount)}</span>
          </div>
          <p className="text-[10px] text-[var(--t-text-4)]">
            {formatWhen(r.refundedAt)} · {r.reason}
          </p>
        </div>
      ))}

      {canRefund && (
        <button
          type="button"
          onClick={() => setRefunding(true)}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
        >
          <Undo2 className="h-3.5 w-3.5" /> Devolución
        </button>
      )}

      {reversing && (
        <ReversePaymentDialog
          order={order}
          payment={reversing}
          onClose={() => setReversing(null)}
        />
      )}
      {refunding && (
        <RefundDialog
          order={order}
          paymentMethods={paymentMethods}
          onClose={() => setRefunding(false)}
        />
      )}
    </>
  );
}
