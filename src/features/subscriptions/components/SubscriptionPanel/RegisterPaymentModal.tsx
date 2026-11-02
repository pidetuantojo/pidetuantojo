'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker/DatePicker';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { computePaymentPeriod, currentEndYmd, todayYmd } from '@/lib/subscription/billing';
import { MAX_PERIODS, PAYMENT_METHODS, RECEIPT_MAX_BYTES, RECEIPT_TYPES } from '@/lib/subscription/payment.schema';
import { formatCurrency } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';
import type { Plan, Restaurant, SubscriptionPaymentMethod } from '@/types';

import { useRegisterSubscriptionPayment } from '../../hooks/useSubscriptionPayments';
import { fmtYmd, periodsLabel } from './subscription.format';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  plan?: Plan;
}

const sg = 'var(--font-sans, sans-serif)';

/** Registrar un pago: el servidor guarda el pago y mueve el vencimiento. Acá solo se muestra la vista previa. */
export function RegisterPaymentModal({ isOpen, onClose, restaurant, plan }: Props) {
  const billingPeriod = plan?.billingPeriod ?? 'monthly';
  const register = useRegisterSubscriptionPayment(restaurant.id);
  const { showToast } = useToastStore();

  const [paidAt, setPaidAt] = useState(todayYmd());
  const [periods, setPeriods] = useState(1);
  const [amount, setAmount] = useState('');
  const [amountEdited, setAmountEdited] = useState(false);
  const [method, setMethod] = useState<SubscriptionPaymentMethod>('nequi');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState('');

  // Cada vez que se abre arranca limpio
  useEffect(() => {
    if (!isOpen) return;
    setPaidAt(todayYmd());
    setPeriods(1);
    setAmount(plan?.price ? String(plan.price) : '');
    setAmountEdited(false);
    setMethod('nequi');
    setReference('');
    setNote('');
    setReceipt(null);
    setError('');
  }, [isOpen, plan?.price]);

  // Mientras no lo toquen, el monto sigue al precio del plan × períodos
  useEffect(() => {
    if (!amountEdited && plan?.price) setAmount(String(plan.price * periods));
  }, [periods, plan?.price, amountEdited]);

  const currentEnd = currentEndYmd(restaurant, billingPeriod);
  const preview = computePaymentPeriod({ currentEnd, anchorDay: restaurant.subscriptionAnchorDay, paidAt, periods, billingPeriod });

  function pickReceipt(file: File | undefined) {
    setError('');
    if (!file) { setReceipt(null); return; }
    if (!RECEIPT_TYPES.includes(file.type)) { setError('El comprobante debe ser una imagen (JPG, PNG, WEBP) o un PDF'); return; }
    if (file.size > RECEIPT_MAX_BYTES) { setError('El comprobante pesa más de 5 MB'); return; }
    setReceipt(file);
  }

  async function handleSubmit() {
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 0) { setError('Escribe el monto sin puntos ni decimales'); return; }
    if (paidAt > todayYmd()) { setError('La fecha de pago no puede ser futura'); return; }
    setError('');
    try {
      await register.mutateAsync({ amount: value, paidAt, method, periods, reference: reference.trim(), note: note.trim(), receipt });
      showToast(`Pago registrado. Nuevo vencimiento: ${fmtYmd(preview.periodEnd)}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago');
    }
  }

  const busy = register.isPending;

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => undefined : onClose} title="Registrar pago" description={`${restaurant.name} · Plan ${plan?.name ?? restaurant.planName ?? ''}`} size="md">
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: sg }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-2)' }}>Fecha del pago</span>
            <DatePicker value={paidAt} onChange={setPaidAt} disabled={busy} />
          </div>
          <Select
            label="Cubre"
            value={String(periods)}
            onChange={(v) => setPeriods(Number(v))}
            options={Array.from({ length: MAX_PERIODS }, (_, i) => ({ value: String(i + 1), label: periodsLabel(i + 1, billingPeriod) }))}
            disabled={busy}
          />
          <Input
            label="Monto (COP)"
            inputMode="numeric"
            value={amount}
            onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); setAmountEdited(true); }}
            hint={amount ? formatCurrency(Number(amount)) : undefined}
            disabled={busy}
          />
          <Select
            label="Medio de pago"
            value={method}
            onChange={(v) => setMethod(v as SubscriptionPaymentMethod)}
            options={PAYMENT_METHODS}
            disabled={busy}
          />
        </div>

        <Input label="Referencia (opcional)" placeholder="Ej: número de la transferencia" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} disabled={busy} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-2)' }}>Comprobante (opcional)</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1.5px dashed var(--t-border)', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, color: 'var(--t-text-2)' }}>
            <input type="file" accept={RECEIPT_TYPES.join(',')} disabled={busy} style={{ display: 'none' }} onChange={(e) => pickReceipt(e.target.files?.[0])} />
            📎 {receipt ? receipt.name : 'Subir imagen o PDF (máx. 5 MB)'}
            {receipt && (
              <button type="button" onClick={(e) => { e.preventDefault(); setReceipt(null); }} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--t-text-3)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>
                Quitar
              </button>
            )}
          </label>
          <span style={{ fontSize: 12, color: 'var(--t-text-4)' }}>Queda privado: solo el super admin lo puede ver.</span>
        </div>

        <Textarea label="Nota (opcional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} disabled={busy} />

        <div style={{ borderRadius: 12, padding: '12px 14px', background: '#DFF3E7', color: '#1f5c3d', fontSize: 13, lineHeight: 1.5 }}>
          Cubre del <strong>{fmtYmd(preview.periodStart)}</strong> al <strong>{fmtYmd(preview.periodEnd)}</strong>.
          {' '}Nuevo vencimiento: <strong>{fmtYmd(preview.periodEnd)}</strong>.
          {currentEnd && !preview.continues && (
            <div style={{ marginTop: 4, color: '#92400e' }}>
              Venció el {fmtYmd(currentEnd)} y ya pasó la gracia: el período arranca el día del pago.
            </div>
          )}
          {restaurant.subscriptionTrialEndDate && !restaurant.lastSubscriptionPaymentId && preview.continues && (
            <div style={{ marginTop: 4 }}>Primer pago: se suma después de los días gratis de prueba.</div>
          )}
        </div>

        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={handleSubmit} isLoading={busy}>Registrar pago</Button>
        </div>
      </div>
    </Modal>
  );
}
