'use client';

import { useMemo, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/features/auth';
import { PaymentMethodPicker } from '@/features/payment-methods/components/PaymentMethodPicker';
import { getActivePaymentMethods, getPaymentLabel } from '@/features/payment-methods/helpers/payment-methods.helpers';
import type { Order, OrderPayment, PaymentMethodConfig } from '@/types';

import { changeFor, createPaymentId, remainingAmount, splitEvenly } from '../../helpers/payments.helpers';
import { ordersService } from '../../services/orders.service';
import { DialogButton, DrawerDialog, MoneyInput, toInt } from './ui';

interface PaymentDialogProps {
  order: Order;
  restaurantId: string;
  paymentMethods?: PaymentMethodConfig[];
  // 'split' abre directamente "Dividir cuenta"
  mode: 'pay' | 'split';
  onClose: () => void;
}

function buildPayment(method: PaymentMethodConfig, amount: number, extra: Partial<OrderPayment>, userId?: string): OrderPayment {
  return {
    id: createPaymentId(),
    amount,
    method: getPaymentLabel(method),
    methodType: method.type,
    ...(method.account ? { account: method.account } : {}),
    ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== '')),
    paidAt: new Date().toISOString(),
    ...(userId ? { paidBy: userId } : {}),
  };
}

/** Método configurado que coincide con el elegido por el cliente (para preseleccionarlo). */
function defaultMethodId(order: Order, methods: PaymentMethodConfig[]): string {
  return methods.find((m) => m.type === order.paymentMethodType && (m.account ?? '') === (order.paymentAccount ?? ''))?.id
    ?? methods.find((m) => m.type === order.paymentMethodType)?.id
    ?? methods[0]?.id
    ?? '';
}

interface SplitRow {
  key: string;
  amount: string;
  methodId: string;
  paid: boolean;
}

export function PaymentDialog({ order, restaurantId, paymentMethods, mode: initialMode, onClose }: PaymentDialogProps) {
  const { user } = useAuth();
  const methods = getActivePaymentMethods(paymentMethods);
  const remaining = remainingAmount(order);
  const [mode, setMode] = useState(initialMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // — Pagar —
  const [amount, setAmount] = useState(String(remaining));
  const [methodId, setMethodId] = useState(() => defaultMethodId(order, methods));
  const [received, setReceived] = useState('');
  const method = methods.find((m) => m.id === methodId);
  const isCash = method?.type === 'efectivo';
  const payValue = toInt(amount);

  // — Dividir — (sobre lo pendiente al abrir: al cobrar cada parte el pendiente en vivo baja)
  const [splitBase] = useState(remaining);
  const [parts, setParts] = useState(2);
  const [rows, setRows] = useState<SplitRow[]>(() => makeRows(2));
  function makeRows(n: number): SplitRow[] {
    return splitEvenly(splitBase, n).map((a, i) => ({ key: `r${i}`, amount: String(a), methodId: defaultMethodId(order, methods), paid: false }));
  }
  function changeParts(delta: number) {
    const n = Math.min(20, Math.max(2, parts + delta));
    setParts(n);
    setRows(makeRows(n));
  }
  const splitSum = useMemo(() => rows.reduce((s, r) => s + toInt(r.amount), 0), [rows]);

  async function register(payments: OrderPayment[]) {
    setSaving(true);
    setError('');
    try {
      await ordersService.addPayments(restaurantId, order, payments);
      return true;
    } catch {
      setError('No se pudo registrar el pago. Intenta de nuevo.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePay() {
    if (!method || payValue <= 0) return;
    const ok = await register([buildPayment(method, payValue, isCash && received ? { received: toInt(received) } : {}, user?.uid)]);
    if (ok) onClose();
  }

  async function handlePayRow(index: number) {
    const row = rows[index];
    const m = methods.find((x) => x.id === row.methodId);
    const value = toInt(row.amount);
    if (!m || value <= 0) return;
    const ok = await register([buildPayment(m, value, { label: `Persona ${index + 1}` }, user?.uid)]);
    if (ok) setRows((prev) => prev.map((r, i) => (i === index ? { ...r, paid: true } : r)));
  }

  const allRowsPaid = rows.every((r) => r.paid);

  return (
    <DrawerDialog
      title={mode === 'pay' ? 'Registrar pago' : 'Dividir cuenta'}
      subtitle={`Pedido #${order.orderNumber} · Pendiente ${formatCurrency(remaining)}`}
      onClose={onClose}
      footer={
        mode === 'pay' ? (
          <>
            <DialogButton tone="ghost" onClick={onClose}>Cancelar</DialogButton>
            <DialogButton tone="success" onClick={handlePay} disabled={saving || !method || payValue <= 0}>
              {saving ? 'Guardando...' : `Cobrar ${formatCurrency(payValue)}`}
            </DialogButton>
          </>
        ) : (
          <DialogButton tone={allRowsPaid ? 'success' : 'ghost'} onClick={onClose}>
            {allRowsPaid ? 'Listo' : 'Cerrar'}
          </DialogButton>
        )
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-[var(--t-surface-2)] p-1">
        {(['pay', 'split'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-1.5 text-xs font-bold transition-colors ${mode === m ? 'bg-[var(--t-surface)] text-[#FF6A1A] shadow-sm' : 'text-[var(--t-text-3)]'}`}
          >
            {m === 'pay' ? 'Pago único' : 'Dividir'}
          </button>
        ))}
      </div>

      {methods.length === 0 && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">No hay métodos de pago activos en la configuración.</p>
      )}

      {mode === 'pay' ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="pay-amount" className="mb-1.5 block text-xs font-semibold text-[var(--t-text-2)]">Valor a cobrar</label>
            <MoneyInput id="pay-amount" value={amount} onChange={setAmount} autoFocus />
            {payValue > 0 && payValue < remaining && (
              <p className="mt-1 text-[11px] text-amber-600">Pago parcial: quedarán {formatCurrency(remaining - payValue)} pendientes.</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--t-text-2)]">Método de pago</p>
            <PaymentMethodPicker methods={methods} value={methodId} onChange={setMethodId} />
          </div>
          {isCash && (
            <div>
              <label htmlFor="pay-received" className="mb-1.5 block text-xs font-semibold text-[var(--t-text-2)]">Recibido en efectivo</label>
              <MoneyInput id="pay-received" value={received} onChange={setReceived} placeholder={String(payValue)} />
              {toInt(received) > 0 && (
                <p className={`mt-1.5 text-sm font-bold ${toInt(received) < payValue ? 'text-red-500' : 'text-emerald-600'}`}>
                  {toInt(received) < payValue
                    ? `Faltan ${formatCurrency(payValue - toInt(received))}`
                    : `Cambio: ${formatCurrency(changeFor(payValue, toInt(received)))}`}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--t-text-2)]">¿Entre cuántas personas?</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => changeParts(-1)} disabled={parts <= 2 || rows.some((r) => r.paid)} aria-label="Menos personas"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--t-border)] disabled:opacity-40">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-base font-bold tabular-nums text-[var(--t-text-1)]">{parts}</span>
              <button type="button" onClick={() => changeParts(1)} disabled={rows.some((r) => r.paid)} aria-label="Más personas"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--t-border)] disabled:opacity-40">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {rows.map((row, i) => (
            <div key={row.key} className={`space-y-2 rounded-xl border p-3 ${row.paid ? 'border-emerald-200 bg-emerald-50/60' : 'border-[var(--t-border)]'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--t-text-1)]">Persona {i + 1}</span>
                {row.paid && <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600"><Check className="h-3.5 w-3.5" /> Pagado</span>}
              </div>
              {!row.paid && (
                <>
                  <MoneyInput value={row.amount} onChange={(v) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, amount: v } : r)))} />
                  <select
                    value={row.methodId}
                    onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, methodId: e.target.value } : r)))}
                    aria-label={`Método de pago persona ${i + 1}`}
                    className="w-full rounded-xl border border-[var(--t-input-border)] bg-[var(--t-input-bg)] px-3 py-2 text-sm text-[var(--t-text-1)] outline-none"
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>{getPaymentLabel(m)}{m.account ? ` · ${m.account}` : ''}</option>
                    ))}
                  </select>
                  <DialogButton tone="success" className="w-full" onClick={() => handlePayRow(i)} disabled={saving || toInt(row.amount) <= 0}>
                    Cobrar {formatCurrency(toInt(row.amount))}
                  </DialogButton>
                </>
              )}
              {row.paid && <p className="text-sm font-bold text-emerald-700">{formatCurrency(toInt(row.amount))}</p>}
            </div>
          ))}

          {splitSum !== splitBase && !allRowsPaid && (
            <p className={`text-xs font-semibold ${splitSum > splitBase ? 'text-red-500' : 'text-amber-600'}`}>
              Las partes suman {formatCurrency(splitSum)} ({splitSum > splitBase ? 'sobran' : 'faltan'} {formatCurrency(Math.abs(splitBase - splitSum))}).
            </p>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-xs text-red-500">{error}</p>}
    </DrawerDialog>
  );
}
