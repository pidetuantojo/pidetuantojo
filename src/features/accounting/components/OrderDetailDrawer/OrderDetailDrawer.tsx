'use client';

import { useEffect } from 'react';
import { Bike, Clock, CreditCard, MapPin, MessageSquare, ShoppingBag, User, UtensilsCrossed, X } from 'lucide-react';

import { formatCurrency, formatDate } from '@/lib/utils';
import { getOrderTotals } from '@/features/orders/helpers/totals.helpers';
import type { Order, OrderStatus } from '@/types';

import { buildOrderTimeline, deliveryLabel, formatDuration } from '../../helpers/orderDetail.helpers';

interface OrderDetailDrawerProps {
  order: Order | null;
  statuses: OrderStatus[];
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 py-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--t-text-4)' }}>{title}</h4>
      {children}
    </section>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm" style={{ color: 'var(--t-text-1)' }}>
      <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--t-text-4)' }}>{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function AmountRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${strong ? 'font-bold' : ''}`} style={{ color: muted ? 'var(--t-text-3)' : 'var(--t-text-1)' }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const DELIVERY_ICON = {
  domicilio: <Bike className="h-4 w-4" />,
  mesa: <UtensilsCrossed className="h-4 w-4" />,
  recoger: <ShoppingBag className="h-4 w-4" />,
};

/** Detalle de solo lectura de un pedido: datos, productos, montos, pagos y línea de tiempo de estados. */
export function OrderDetailDrawer({ order, statuses, onClose }: OrderDetailDrawerProps) {
  useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, onClose]);

  if (!order) return null;

  const status = statuses.find((s) => s.id === order.statusId);
  const totals = getOrderTotals(order);
  const timeline = buildOrderTimeline(order, statuses);
  const deliveryType = order.deliveryType ?? 'recoger';
  const promoDiscount = Math.max(0, totals.discount - (order.manualDiscount ?? 0));

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle del pedido ${order.orderNumber}`}
        className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-[440px] flex-col shadow-2xl"
        style={{ background: 'var(--t-surface)', animation: 'order-detail-in .22s ease-out' }}
      >
        <style dangerouslySetInnerHTML={{ __html: '@keyframes order-detail-in { from { transform: translateX(100%); } to { transform: translateX(0); } }' }} />

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--t-border)' }}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="font-mono text-lg font-extrabold" style={{ color: 'var(--t-text-1)' }}>{order.orderNumber}</span>
            {status && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: status.color }}>
                {status.name}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full hover:bg-[var(--t-surface-2)]" style={{ color: 'var(--t-text-3)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 divide-y overflow-y-auto px-5" style={{ borderColor: 'var(--t-border)' }}>
          {/* Tiempos */}
          <Section title="Tiempos">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3" style={{ background: 'var(--t-surface-2)' }}>
                <p className="text-[11px]" style={{ color: 'var(--t-text-4)' }}>Creado</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--t-text-1)' }}>{formatDate(order.createdAt)}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--t-surface-2)' }}>
                <p className="text-[11px]" style={{ color: 'var(--t-text-4)' }}>Entregado</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--t-text-1)' }}>
                  {timeline.deliveredAt ? formatDate(timeline.deliveredAt) : '—'}
                </p>
              </div>
            </div>
            {timeline.fulfillmentMs !== undefined && (
              <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--t-text-2)' }}>
                <Clock className="h-4 w-4" style={{ color: '#FF6A1A' }} />
                Tiempo total: <strong style={{ color: 'var(--t-text-1)' }}>{formatDuration(timeline.fulfillmentMs)}</strong>
              </p>
            )}
            {order.isScheduled && order.scheduledFor && (
              <p className="text-xs" style={{ color: 'var(--t-text-3)' }}>Programado para {formatDate(order.scheduledFor)}</p>
            )}
          </Section>

          {/* Línea de tiempo */}
          <Section title="Movimientos del pedido">
            <ol className="relative ml-1.5 space-y-3 pl-5" style={{ borderLeft: '2px solid var(--t-border)' }}>
              {timeline.entries.map((e) => (
                <li key={e.key} className="relative">
                  <span
                    className="absolute -left-[27px] top-1 h-3 w-3 rounded-full"
                    style={{ background: e.color ?? 'var(--t-text-4)', boxShadow: '0 0 0 3px var(--t-surface)' }}
                  />
                  <p className="text-sm font-semibold" style={{ color: 'var(--t-text-1)' }}>{e.label}</p>
                  <p className="text-xs" style={{ color: 'var(--t-text-3)' }}>
                    {formatDate(e.at)}{e.byName ? ` · ${e.byName}` : ''}
                  </p>
                </li>
              ))}
            </ol>
            {!timeline.hasHistory && (
              <p className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-3)' }}>
                Este pedido es anterior al registro de estados: solo se conoce la hora de creación.
              </p>
            )}
          </Section>

          {/* Cliente y entrega */}
          <Section title="Cliente y entrega">
            <Row icon={<User className="h-4 w-4" />}>
              <p className="font-semibold">{order.customerName || '—'}</p>
              {order.customerPhone && <p className="text-xs" style={{ color: 'var(--t-text-3)' }}>{order.customerPhone}</p>}
            </Row>
            <Row icon={DELIVERY_ICON[deliveryType]}>
              <p>{deliveryLabel(order)}</p>
            </Row>
            {deliveryType === 'domicilio' && (order.customerAddress || order.barrio) && (
              <Row icon={<MapPin className="h-4 w-4" />}>
                <p>{order.customerAddress}</p>
                {order.barrio && <p className="text-xs" style={{ color: 'var(--t-text-3)' }}>{order.barrio}</p>}
              </Row>
            )}
            {order.assignedDriver && (
              <Row icon={<Bike className="h-4 w-4" />}>
                <p>
                  {order.assignedDriver.name}
                  {order.assignedDriver.courierName && <span style={{ color: 'var(--t-text-3)' }}> · {order.assignedDriver.courierName}</span>}
                </p>
                <p className="text-xs" style={{ color: 'var(--t-text-3)' }}>{order.assignedDriver.isCompany ? 'Empresa de domicilios' : 'Domiciliario'}</p>
              </Row>
            )}
            {(order.notes || order.internalNote) && (
              <Row icon={<MessageSquare className="h-4 w-4" />}>
                {order.notes && <p>{order.notes}</p>}
                {order.internalNote && <p className="text-xs" style={{ color: 'var(--t-text-3)' }}>Nota interna: {order.internalNote}</p>}
              </Row>
            )}
          </Section>

          {/* Productos */}
          <Section title={`Productos (${order.items.length})`}>
            <ul className="space-y-2.5">
              {order.items.map((item, i) => (
                <li key={`${item.productId}-${i}`} className="flex justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p style={{ color: 'var(--t-text-1)' }}>
                      <span className="font-semibold">{item.quantity}×</span> {item.productName}
                      {item.isGift && <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">REGALO</span>}
                    </p>
                    {item.additionals.length > 0 && (
                      <p className="text-xs" style={{ color: 'var(--t-text-3)' }}>+ {item.additionals.map((a) => a.name).join(', ')}</p>
                    )}
                    {item.specialInstructions && <p className="text-xs italic" style={{ color: 'var(--t-text-3)' }}>“{item.specialInstructions}”</p>}
                    {item.promotionName && <p className="text-xs" style={{ color: '#FF6A1A' }}>{item.promotionName}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p style={{ color: 'var(--t-text-1)' }}>{formatCurrency(item.subtotal - (item.discount ?? 0))}</p>
                    {!!item.discount && <p className="text-xs line-through" style={{ color: 'var(--t-text-4)' }}>{formatCurrency(item.subtotal)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/* Montos */}
          <Section title="Montos">
            <AmountRow label="Productos" value={formatCurrency(totals.productsTotal)} />
            {promoDiscount > 0 && <AmountRow label="Promociones" value={`− ${formatCurrency(promoDiscount)}`} muted />}
            {!!order.manualDiscount && (
              <AmountRow label={`Descuento manual${order.manualDiscountReason ? ` (${order.manualDiscountReason})` : ''}`} value={`− ${formatCurrency(order.manualDiscount)}`} muted />
            )}
            {deliveryType === 'domicilio' && (
              <AmountRow label="Domicilio" value={order.freeDelivery ? 'Gratis' : formatCurrency(totals.deliveryFee)} muted />
            )}
            <AmountRow label="Total" value={formatCurrency(totals.total)} strong />
            {(order.appliedPromotions ?? []).length > 0 && (
              <p className="text-xs" style={{ color: 'var(--t-text-3)' }}>
                Promociones: {order.appliedPromotions!.map((p) => (p.type === 'loyalty' ? 'Premio de fidelidad' : p.name)).join(', ')}
                {order.couponCode ? ` · Cupón ${order.couponCode}` : ''}
              </p>
            )}
          </Section>

          {/* Pagos */}
          <Section title="Pago">
            {order.payments && order.payments.length > 0 ? (
              <ul className="space-y-2">
                {order.payments.map((p) => (
                  <li key={p.id}>
                    <Row icon={<CreditCard className="h-4 w-4" />}>
                      <div className="flex justify-between gap-2">
                        <span>
                          {p.method}
                          {p.label && <span style={{ color: 'var(--t-text-3)' }}> · {p.label}</span>}
                        </span>
                        <span className="font-semibold">{formatCurrency(p.amount)}</span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--t-text-3)' }}>
                        {formatDate(p.paidAt)}
                        {p.received && p.received > p.amount ? ` · Recibió ${formatCurrency(p.received)}, cambio ${formatCurrency(p.received - p.amount)}` : ''}
                      </p>
                    </Row>
                  </li>
                ))}
              </ul>
            ) : (
              <Row icon={<CreditCard className="h-4 w-4" />}>
                <div className="flex justify-between gap-2">
                  <span>
                    {order.paymentMethod}
                    {order.paymentAccount && <span style={{ color: 'var(--t-text-3)' }}> · {order.paymentAccount}</span>}
                  </span>
                  <span className={`text-xs font-semibold ${order.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {order.isPaid ? 'Pagado' : 'Pendiente'}
                  </span>
                </div>
              </Row>
            )}
          </Section>
        </div>
      </aside>
    </>
  );
}
