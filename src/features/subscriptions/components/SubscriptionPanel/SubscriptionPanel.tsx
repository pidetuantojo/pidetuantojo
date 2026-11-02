'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { usePlan } from '@/features/plans/hooks/usePlans';
import { getSubscriptionInfo } from '@/lib/subscription/subscription';
import { formatCurrency } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';
import type { Restaurant, SubscriptionPayment } from '@/types';

import { useSubscriptionPayments, useVoidSubscriptionPayment } from '../../hooks/useSubscriptionPayments';
import { subscriptionPaymentsService } from '../../services/subscriptionPayments.service';
import { RegisterPaymentModal } from './RegisterPaymentModal';
import { fmtYmd, methodLabel, periodsLabel } from './subscription.format';

const sg = 'var(--font-sans, sans-serif)';
const mono = 'var(--font-mono, monospace)';

const STATUS = {
  trial: { label: '● PRUEBA GRATIS', color: '#1d4ed8', bg: '#dbeafe' },
  active: { label: '● ACTIVA', color: '#2C7A52', bg: '#DFF3E7' },
  grace_period: { label: '● PERÍODO DE GRACIA', color: '#92400e', bg: '#fef3c7' },
  suspended: { label: '● SUSPENDIDA', color: '#dc2626', bg: '#fee2e2' },
  no_plan: { label: '○ SIN PLAN', color: 'var(--t-text-3)', bg: 'var(--t-surface-2)' },
};

const linkBtn: React.CSSProperties = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: sg };

/** Suscripción del restaurante (super admin): estado, vencimiento, registrar pagos e historial. */
export function SubscriptionPanel({ restaurant }: { restaurant: Restaurant }) {
  const { data: plan } = usePlan(restaurant.planId);
  const { data: payments = [], isLoading } = useSubscriptionPayments(restaurant.id);
  const voidPayment = useVoidSubscriptionPayment();
  const { showToast } = useToastStore();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [voiding, setVoiding] = useState<SubscriptionPayment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');
  const [openingReceipt, setOpeningReceipt] = useState<string | null>(null);

  const info = getSubscriptionInfo(restaurant, plan?.billingPeriod);
  const status = info.inTrial && info.status === 'active' ? STATUS.trial : STATUS[info.status];
  const endYmd = info.endDate ? info.endDate.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : null;

  async function openReceipt(id: string) {
    // La pestaña se abre ya (si no, el navegador la bloquea) y se llena cuando llega el enlace firmado
    const tab = window.open('', '_blank');
    setOpeningReceipt(id);
    try {
      const url = await subscriptionPaymentsService.receiptUrl(id);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      tab?.close();
      showToast(err instanceof Error ? err.message : 'No se pudo abrir el comprobante', 'error');
    } finally {
      setOpeningReceipt(null);
    }
  }

  async function confirmVoid() {
    if (!voiding) return;
    if (voidReason.trim().length < 3) { setVoidError('Escribe el motivo'); return; }
    try {
      await voidPayment.mutateAsync({ id: voiding.id, reason: voidReason.trim() });
      showToast('Pago anulado. El vencimiento volvió al anterior.');
      setVoiding(null);
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : 'No se pudo anular el pago');
    }
  }

  return (
    <section style={{ borderRadius: 18, border: '1px solid #EFE7DF', background: '#fff', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, fontFamily: sg, flexShrink: 0 }}>
      {/* Estado */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1B1512' }}>Suscripción</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', color: status.color, background: status.bg, borderRadius: 999, padding: '4px 10px' }}>
              {status.label}
            </span>
            {endYmd && (
              <span style={{ fontSize: 13, color: 'var(--t-text-2)' }}>
                {info.status === 'active' ? 'Vence' : 'Venció'} el <strong>{fmtYmd(endYmd)}</strong>
                {info.status === 'active' && info.daysUntilEnd !== null && (
                  <span style={{ color: info.daysUntilEnd <= 7 ? '#92400e' : 'var(--t-text-3)' }}> · en {info.daysUntilEnd} {info.daysUntilEnd === 1 ? 'día' : 'días'}</span>
                )}
                {info.status === 'grace_period' && info.graceDaysLeft !== null && (
                  <span style={{ color: '#92400e', fontWeight: 600 }}> · {info.graceDaysLeft} días hábiles de gracia</span>
                )}
              </span>
            )}
          </div>
          {plan && (
            <span style={{ fontSize: 12, color: 'var(--t-text-3)' }}>
              Plan {plan.name} · {formatCurrency(plan.price)} {plan.billingPeriod === 'yearly' ? 'al año' : 'al mes'}
            </span>
          )}
        </div>
        <Button type="button" onClick={() => setRegisterOpen(true)} disabled={!restaurant.planId} title={restaurant.planId ? undefined : 'Asígnale un plan primero'}>
          + Registrar pago
        </Button>
      </div>
      {!restaurant.planId && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--t-text-3)' }}>Asígnale un plan al restaurante (abajo) para poder registrar pagos.</p>
      )}

      {/* Historial */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.06em', color: 'var(--t-text-3)', textTransform: 'uppercase' }}>Historial de pagos</span>
        {isLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-3)' }}>Cargando...</p>
        ) : payments.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-3)', padding: '12px 14px', borderRadius: 12, border: '1px dashed var(--t-border)' }}>
            Todavía no hay pagos registrados.
          </p>
        ) : (
          payments.map((p) => {
            const voided = p.status === 'voided';
            const canVoid = !voided && p.id === restaurant.lastSubscriptionPaymentId;
            return (
              <div key={p.id} style={{ borderRadius: 12, border: '1px solid var(--t-border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, opacity: voided ? 0.65 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1B1512', textDecoration: voided ? 'line-through' : 'none' }}>
                    {formatCurrency(p.amount)} <span style={{ fontWeight: 500, color: 'var(--t-text-3)' }}>· {methodLabel(p.method)}</span>
                  </span>
                  {voided && (
                    <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fee2e2', borderRadius: 999, padding: '2px 8px' }}>ANULADO</span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--t-text-2)' }}>
                  Pagó el {fmtYmd(p.paidAt)} · {periodsLabel(p.periods, p.billingPeriod)}: {fmtYmd(p.periodStart)} → {fmtYmd(p.periodEnd)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--t-text-3)' }}>
                  {p.reference && <>Ref. {p.reference} · </>}
                  Registrado por {p.createdBy.name ?? 'super admin'} el {new Date(p.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })}
                </span>
                {p.note && <span style={{ fontSize: 12, color: 'var(--t-text-2)', fontStyle: 'italic' }}>“{p.note}”</span>}
                {voided && (
                  <span style={{ fontSize: 12, color: '#dc2626' }}>
                    Anulado por {p.voidedBy?.name ?? 'super admin'}{p.voidReason ? `: ${p.voidReason}` : ''}
                  </span>
                )}
                {(p.receipt || canVoid) && (
                  <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                    {p.receipt && (
                      <button type="button" onClick={() => openReceipt(p.id)} disabled={openingReceipt === p.id} style={{ ...linkBtn, color: '#FF6A1A' }}>
                        {openingReceipt === p.id ? 'Abriendo...' : '📎 Ver comprobante'}
                      </button>
                    )}
                    {canVoid && (
                      <button type="button" onClick={() => { setVoiding(p); setVoidReason(''); setVoidError(''); }} style={{ ...linkBtn, color: '#dc2626' }}>
                        Anular
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <RegisterPaymentModal isOpen={registerOpen} onClose={() => setRegisterOpen(false)} restaurant={restaurant} plan={plan ?? undefined} />

      <Modal
        isOpen={!!voiding}
        onClose={() => !voidPayment.isPending && setVoiding(null)}
        title="Anular pago"
        description={voiding ? `${formatCurrency(voiding.amount)} del ${fmtYmd(voiding.paidAt)}. Queda en el historial como anulado y el vencimiento vuelve al ${voiding.previousEndDate ? fmtYmd(voiding.previousEndDate) : 'anterior'}.` : undefined}
        size="sm"
      >
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Textarea label="Motivo" rows={2} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Ej: lo registré dos veces" maxLength={300} error={voidError || undefined} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button type="button" variant="secondary" onClick={() => setVoiding(null)} disabled={voidPayment.isPending}>Cancelar</Button>
            <Button type="button" variant="danger" onClick={confirmVoid} isLoading={voidPayment.isPending}>Anular pago</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
