'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { usePlans } from '@/features/plans/hooks/usePlans';
import { useRestaurants } from '@/features/restaurants/hooks/useRestaurants';
import { todayYmd } from '@/lib/subscription/billing';
import { PAYMENT_METHODS } from '@/lib/subscription/payment.schema';
import { formatCurrency } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';

import {
  dueRestaurants, filterPayments, monthLabel, monthOf, paymentMonths, previousMonth, sumPayments, type DueItem,
} from '../../helpers/payments.helpers';
import { useAllSubscriptionPayments } from '../../hooks/useSubscriptionPayments';
import { subscriptionPaymentsService } from '../../services/subscriptionPayments.service';
import { RegisterPaymentModal } from '../SubscriptionPanel/RegisterPaymentModal';
import { fmtYmd, methodLabel, periodsLabel } from '../SubscriptionPanel/subscription.format';

const sg = 'var(--font-sans, sans-serif)';
const mono = 'var(--font-mono, monospace)';
const card: React.CSSProperties = { borderRadius: 18, border: '1px solid #EFE7DF', background: '#fff', padding: 20 };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 700, color: '#1B1512' };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontFamily: mono, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--t-text-3)', fontWeight: 600, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '12px', fontSize: 13, color: 'var(--t-text-2)', borderTop: '1px solid var(--t-border)', verticalAlign: 'top' };

function dueBadge({ info }: DueItem) {
  if (info.status === 'suspended') return { label: 'SUSPENDIDO', color: '#dc2626', bg: '#fee2e2' };
  if (info.status === 'grace_period') return { label: 'EN GRACIA', color: '#92400e', bg: '#fef3c7' };
  if (info.inTrial) return { label: 'FIN DE PRUEBA', color: '#1d4ed8', bg: '#dbeafe' };
  return { label: 'POR VENCER', color: '#2C7A52', bg: '#DFF3E7' };
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--t-text-3)' }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color: '#1B1512', letterSpacing: '-.02em' }}>{value}</span>
      {hint && <span style={{ fontSize: 12, color: 'var(--t-text-3)' }}>{hint}</span>}
    </div>
  );
}

/** Pagos de suscripción de todos los restaurantes: lo cobrado, a quién cobrarle y el historial. */
export function PaymentsDashboard() {
  const { data: payments = [], isLoading } = useAllSubscriptionPayments();
  const { data: restaurants = [] } = useRestaurants();
  const { data: plans = [] } = usePlans();
  const { showToast } = useToastStore();

  const [month, setMonth] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [method, setMethod] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [paying, setPaying] = useState<DueItem | null>(null);

  const thisMonth = monthOf(todayYmd());
  const lastMonth = previousMonth(thisMonth);
  const current = sumPayments(payments.filter((p) => monthOf(p.paidAt) === thisMonth));
  const previous = sumPayments(payments.filter((p) => monthOf(p.paidAt) === lastMonth));
  const due = useMemo(() => dueRestaurants(restaurants, plans), [restaurants, plans]);

  const filtered = filterPayments(payments, { month, restaurantId, method, showVoided });
  const filteredSum = sumPayments(filtered);
  const months = paymentMonths(payments);

  async function openReceipt(id: string) {
    const tab = window.open('', '_blank');
    try {
      const url = await subscriptionPaymentsService.receiptUrl(id);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      tab?.close();
      showToast(err instanceof Error ? err.message : 'No se pudo abrir el comprobante', 'error');
    }
  }

  return (
    <div style={{ fontFamily: sg, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>
      <div>
        <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: '#1B1512', margin: 0 }}>Pagos de suscripciones</h1>
        <p style={{ fontSize: 13, color: '#9a8f86', margin: '3px 0 0' }}>Lo cobrado a los restaurantes, a quién falta cobrarle y el historial de pagos.</p>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Kpi label={`Cobrado en ${monthLabel(thisMonth)}`} value={formatCurrency(current.total)} hint={`${current.count} ${current.count === 1 ? 'pago' : 'pagos'}`} />
        <Kpi label={`Cobrado en ${monthLabel(lastMonth)}`} value={formatCurrency(previous.total)} hint={`${previous.count} ${previous.count === 1 ? 'pago' : 'pagos'}`} />
        <Kpi label="Por cobrar" value={String(due.length)} hint={due.length === 1 ? 'restaurante' : 'restaurantes'} />
      </div>

      {/* Por cobrar */}
      <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h2 style={sectionTitle}>Por cobrar</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t-text-3)' }}>Suspendidos, en período de gracia o que vencen en los próximos 7 días.</p>
        </div>
        {due.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-3)', padding: '12px 14px', borderRadius: 12, border: '1px dashed var(--t-border)' }}>
            Todos al día 🎉
          </p>
        ) : due.map((item) => {
          const badge = dueBadge(item);
          const { restaurant, plan, info } = item;
          const endYmd = info.endDate?.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
          return (
            <div key={restaurant.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--t-border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Link href={ROUTES.admin.restaurant(restaurant.id)} style={{ fontSize: 14, fontWeight: 700, color: '#1B1512', textDecoration: 'none' }}>{restaurant.name}</Link>
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 999, padding: '2px 8px' }}>{badge.label}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--t-text-3)' }}>
                  {endYmd && <>{info.status === 'active' ? 'Vence' : 'Venció'} el {fmtYmd(endYmd)}</>}
                  {info.status === 'active' && info.daysUntilEnd !== null && <> · en {info.daysUntilEnd} {info.daysUntilEnd === 1 ? 'día' : 'días'}</>}
                  {info.status === 'grace_period' && info.graceDaysLeft !== null && <> · {info.graceDaysLeft} días hábiles de gracia</>}
                  {plan && <> · {plan.name} {formatCurrency(plan.price)}</>}
                </span>
              </div>
              <Button type="button" size="sm" onClick={() => setPaying(item)}>Registrar pago</Button>
            </div>
          );
        })}
      </section>

      {/* Historial */}
      <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={sectionTitle}>Pagos</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t-text-3)' }}>
              {filteredSum.count} {filteredSum.count === 1 ? 'pago' : 'pagos'} · <strong style={{ color: '#1B1512' }}>{formatCurrency(filteredSum.total)}</strong>
              {showVoided && ' (los anulados no suman)'}
            </p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--t-text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} style={{ accentColor: '#FF6A1A' }} />
            Mostrar anulados
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <Select compact value={month} onChange={setMonth} placeholder="Todos los meses"
            options={[{ value: '', label: 'Todos los meses' }, ...months.map((m) => ({ value: m, label: monthLabel(m) }))]} />
          <Select compact searchable value={restaurantId} onChange={setRestaurantId} placeholder="Todos los restaurantes"
            options={[{ value: '', label: 'Todos los restaurantes' }, ...restaurants.map((r) => ({ value: r.id, label: r.name }))]} />
          <Select compact value={method} onChange={setMethod} placeholder="Todos los medios"
            options={[{ value: '', label: 'Todos los medios' }, ...PAYMENT_METHODS]} />
        </div>

        {isLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-3)' }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-3)', padding: '12px 14px', borderRadius: 12, border: '1px dashed var(--t-border)' }}>
            {payments.length === 0 ? 'Todavía no hay pagos registrados. Regístralos desde cada restaurante o desde "Por cobrar".' : 'No hay pagos con esos filtros.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Restaurante</th>
                  <th style={th}>Cubre</th>
                  <th style={th}>Medio</th>
                  <th style={{ ...th, textAlign: 'right' }}>Monto</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const voided = p.status === 'voided';
                  return (
                    <tr key={p.id} style={{ opacity: voided ? 0.6 : 1 }}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtYmd(p.paidAt)}</td>
                      <td style={td}>
                        <Link href={ROUTES.admin.restaurant(p.restaurantId)} style={{ fontWeight: 600, color: '#1B1512', textDecoration: 'none' }}>{p.restaurantName}</Link>
                        <div style={{ fontSize: 12, color: 'var(--t-text-3)' }}>{p.planName}</div>
                      </td>
                      <td style={td}>
                        {periodsLabel(p.periods, p.billingPeriod)}
                        <div style={{ fontSize: 12, color: 'var(--t-text-3)', whiteSpace: 'nowrap' }}>{fmtYmd(p.periodStart)} → {fmtYmd(p.periodEnd)}</div>
                      </td>
                      <td style={td}>
                        {methodLabel(p.method)}
                        {p.reference && <div style={{ fontSize: 12, color: 'var(--t-text-3)' }}>Ref. {p.reference}</div>}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#1B1512', whiteSpace: 'nowrap', textDecoration: voided ? 'line-through' : 'none' }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {voided && <span title={p.voidReason} style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fee2e2', borderRadius: 999, padding: '2px 8px', marginRight: 8 }}>ANULADO</span>}
                        {p.receipt && (
                          <button type="button" onClick={() => openReceipt(p.id)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#FF6A1A', fontFamily: sg }}>
                            📎 Comprobante
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {paying && (
        <RegisterPaymentModal isOpen onClose={() => setPaying(null)} restaurant={paying.restaurant} plan={paying.plan} />
      )}
    </div>
  );
}
