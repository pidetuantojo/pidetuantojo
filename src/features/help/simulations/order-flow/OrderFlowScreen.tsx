'use client';

import { useState } from 'react';
import { Bike, Check, DollarSign, LayoutGrid, MessageCircle, Percent, Plus, Printer, ShoppingBag } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import { OrderCard } from '@/features/orders/components/OrderCard/OrderCard';
import type { Order } from '@/types';

import { DEMO_RESTAURANT, DEMO_STATUSES, demoOrders, statusByCode, type OrderFlowState } from './orderFlow';

const sm = "var(--font-mono, monospace)";
const noop = () => {};

const COLUMNS = [
  { key: 'recoger', label: 'Para llevar', color: '#2563eb', icon: ShoppingBag },
  { key: 'domicilio', label: 'Domicilio', color: '#7c3aed', icon: Bike },
  { key: 'mesa', label: 'Mesa', color: '#16a34a', icon: LayoutGrid },
] as const;

const DRIVER = { id: 'drv-1', name: 'Carlos Ruiz', phone: '3005550142' };

/** Tablero de pedidos simulado. Las tarjetas son el OrderCard real; el panel lateral es una réplica sin servicios. */
export function OrderFlowScreen({ state }: { state: OrderFlowState }) {
  const [now] = useState(() => Date.now());
  const orders = demoOrders(now);

  const main: Order = {
    ...orders.main,
    statusId: statusByCode(state.status).id,
    isPaid: state.paid,
    assignedDriver: state.driver ? DRIVER : undefined,
  };
  const byColumn: Record<string, Order[]> = {
    recoger: [orders.pickup],
    domicilio: state.arrived ? [main, orders.delivery] : [orders.delivery],
    mesa: [orders.table],
  };
  const status = statusByCode(state.status);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--t-bg)', fontSize: 13 }}>
      {/* Barra superior */}
      <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderBottom: '1px solid var(--t-border)', background: 'var(--t-surface)' }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>Pedidos</span>
        <span style={{ fontFamily: sm, fontSize: 11, color: 'var(--t-text-3)' }}>Hoy · {DEMO_RESTAURANT}</span>
        <span style={{ marginLeft: 'auto', background: '#FF6A1A', color: '#fff', borderRadius: 10, padding: '6px 12px', fontWeight: 700, fontSize: 12 }}>+ Nuevo pedido</span>
      </div>

      {/* Columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 14 }}>
        {COLUMNS.map(({ key, label, color, icon: Icon }) => (
          <div key={key}>
            <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, color }}>
              <Icon size={14} /> {label}
              <span style={{ marginLeft: 'auto', fontFamily: sm, fontWeight: 500, color: 'var(--t-text-3)' }}>{byColumn[key].length}</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byColumn[key].map((o) => (
                <div key={o.id} data-flow-target={o.id === main.id ? 'card' : undefined} style={{ borderRadius: 12 }}>
                  <OrderCard
                    order={o}
                    status={DEMO_STATUSES.find((s) => s.id === o.statusId)}
                    selected={o.id === main.id && state.drawerOpen}
                    finished={o.statusId === statusByCode('delivered').id}
                    onOpen={noop}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Notificación de pedido nuevo */}
      <div
        data-flow-target="toast"
        style={{
          position: 'absolute', top: 54, right: 14, width: 220, borderRadius: 14, overflow: 'hidden', color: '#fff', zIndex: 4,
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', boxShadow: '0 12px 28px rgba(234,88,12,.35)',
          transform: state.toast ? 'translateX(0)' : 'translateX(260px)', transition: 'transform .45s cubic-bezier(.32,.72,0,1)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, padding: '10px 12px', alignItems: 'center' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', fontSize: 17 }}>🔔</span>
          <div>
            <b style={{ display: 'block', fontSize: 13 }}>¡Nuevo pedido!</b>
            <small style={{ fontFamily: sm, opacity: 0.85 }}>{main.orderNumber} · Domicilio</small>
          </div>
        </div>
      </div>

      {/* Capa y comanda impresa */}
      <div style={{ position: 'absolute', inset: '46px 0 0 0', background: 'rgba(27,21,18,.06)', opacity: state.drawerOpen ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none' }} />
      <Ticket order={main} visible={state.printing && state.drawerOpen} />

      {/* Panel lateral */}
      <aside
        style={{
          position: 'absolute', top: 46, right: 0, bottom: 0, width: 318, zIndex: 3, display: 'flex', flexDirection: 'column',
          background: 'var(--t-surface)', borderLeft: '1px solid var(--t-border)', boxShadow: '-10px 0 30px rgba(0,0,0,.10)',
          transform: state.drawerOpen ? 'translateX(0)' : 'translateX(105%)', transition: 'transform .42s cubic-bezier(.32,.72,0,1)',
        }}
      >
        <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--t-border)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: sm, fontWeight: 500 }}>{main.orderNumber}</span>
          <span style={{ fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{main.customerName}</span>
          <span style={{ borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 800, background: `${status.color}1f`, color: status.color }}>{status.name}</span>
        </div>

        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, flex: 1, overflow: 'hidden' }}>
          {main.items.map((item) => (
            <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>
                {item.quantity}× {item.productName}
                {(item.additionals.length > 0 || item.specialInstructions) && (
                  <small style={{ display: 'block', color: 'var(--t-text-3)', fontSize: 10.5 }}>
                    {item.additionals.map((a) => `+ ${a.name}`).join(', ') || `Nota: ${item.specialInstructions?.toLowerCase()}`}
                  </small>
                )}
              </span>
              <b>{formatCurrency(item.subtotal)}</b>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--t-text-3)', fontSize: 11 }}>
            <span>Domicilio · {main.barrio}</span><span>{formatCurrency(main.deliveryFee ?? 0)}</span>
          </div>
          <div style={{ borderTop: '1px dashed var(--t-border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span>Total</span><span>{formatCurrency(main.total)}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--t-border)', padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            <Tile target="print" icon={<Printer size={15} />} label={state.printed ? 'Impreso ✓' : 'Imprimir'} done={state.printed} />
            <Tile icon={<Plus size={15} />} label="Agregar" tone="#0f766e" border="#5eead4" />
            <Tile icon={<Percent size={15} />} label="Descuento" tone="#047857" border="#6ee7b7" />
            <Tile target="whatsapp" icon={<MessageCircle size={15} />} label="WhatsApp" tone="#047857" border="#6ee7b7" />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {DEMO_STATUSES.filter((s) => s.code !== 'cancelled').map((s) => {
              const current = s.code === state.status;
              return (
                <span
                  key={s.id}
                  data-flow-target={`status-${s.code}`}
                  style={{ border: `2px solid ${current ? s.color : `${s.color}99`}`, borderRadius: 999, padding: '2px 9px', fontSize: 10.5, fontWeight: 800, background: current ? s.color : 'transparent', color: current ? '#fff' : s.color, transition: 'background .2s, color .2s' }}
                >
                  {s.name}{current ? ' ✓' : ''}
                </span>
              );
            })}
            <span style={{ marginLeft: 'auto', border: '2px solid #fca5a5', color: '#ef4444', borderRadius: 999, padding: '2px 9px', fontSize: 10.5, fontWeight: 800 }}>Cancelar</span>
          </div>

          {state.driver ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#EEF2FF', borderRadius: 11, padding: '6px 9px', fontSize: 11, color: '#4f46e5' }}>
              <Bike size={15} />
              <div><b style={{ display: 'block', fontSize: 11.5, color: '#312e81' }}>{DRIVER.name}</b>Moto · {DRIVER.phone}</div>
            </div>
          ) : (
            <div data-flow-target="driver" style={{ border: '2px solid #ddd6fe', background: '#f5f3ff', color: '#6d28d9', borderRadius: 11, padding: 6, textAlign: 'center', fontWeight: 800, fontSize: 11.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Bike size={14} /> Asignar domiciliario
            </div>
          )}

          <div
            data-flow-target="pay"
            style={{ borderRadius: 11, padding: 8, textAlign: 'center', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: state.paid ? '#ECFDF5' : '#059669', color: state.paid ? '#065F46' : '#fff' }}
          >
            {state.paid ? <><Check size={15} /> Pagado</> : <><DollarSign size={15} /> Pagar</>}
          </div>
        </div>
      </aside>

      <WhatsAppBubble order={main} statusName={status.name} visible={state.whatsapp} />
    </div>
  );
}

function Tile({ icon, label, target, done, tone, border }: { icon: React.ReactNode; label: string; target?: string; done?: boolean; tone?: string; border?: string }) {
  return (
    <span
      data-flow-target={target}
      style={{
        border: `1px solid ${done ? 'transparent' : border ?? 'var(--t-border)'}`, borderRadius: 11, padding: '6px 2px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 10.5, fontWeight: 700,
        background: done ? '#ECFDF5' : 'var(--t-surface)', color: done ? '#065F46' : tone ?? 'var(--t-text-2)', transition: 'background .2s',
      }}
    >
      {icon}{label}
    </span>
  );
}

function Ticket({ order, visible }: { order: Order; visible: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', top: 46, right: 330, width: 170, zIndex: 2, background: '#fffdf8', color: '#1B1512',
        fontFamily: sm, fontSize: 10.5, lineHeight: 1.5, padding: '12px 12px 16px', boxShadow: '0 14px 30px rgba(0,0,0,.25)',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(8px)' : 'translateY(calc(-100% - 60px))', transition: 'transform .9s cubic-bezier(.32,.72,0,1), opacity .3s',
      }}
    >
      <div style={{ textAlign: 'center' }}>{DEMO_RESTAURANT.toUpperCase()}</div>
      <div style={{ textAlign: 'center' }}>COMANDA {order.orderNumber}</div>
      <hr style={{ border: 0, borderTop: '1px dashed #b9ada3', margin: '6px 0' }} />
      {order.items.map((i) => (
        <div key={i.productId}>
          {i.quantity}x {i.productName}
          {i.additionals.map((a) => <div key={a.name}>&nbsp;&nbsp;+ {a.name}</div>)}
          {i.specialInstructions && <div>&nbsp;&nbsp;Nota: {i.specialInstructions.toLowerCase()}</div>}
        </div>
      ))}
      <hr style={{ border: 0, borderTop: '1px dashed #b9ada3', margin: '6px 0' }} />
      DOMICILIO · {order.barrio}<br />TOTAL {formatCurrency(order.total)}
    </div>
  );
}

function WhatsAppBubble({ order, statusName, visible }: { order: Order; statusName: string; visible: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', left: 14, bottom: 14, width: 300, borderRadius: 14, overflow: 'hidden', background: '#ECE5DD', zIndex: 4,
        boxShadow: '0 14px 30px rgba(0,0,0,.25)', transform: visible ? 'translateY(0)' : 'translateY(130%)', transition: 'transform .45s cubic-bezier(.32,.72,0,1)',
      }}
    >
      <div style={{ background: '#075E54', color: '#fff', padding: '7px 10px', fontWeight: 700, fontSize: 12 }}>{order.customerName}</div>
      {/* Mismo texto que arma OrderDrawer (statusMessage) */}
      <div style={{ margin: '9px 10px 10px auto', maxWidth: '88%', background: '#DCF8C6', color: '#1B1512', borderRadius: '10px 2px 10px 10px', padding: '7px 9px', fontSize: 11.5, lineHeight: 1.45 }}>
        Hola {order.customerName}! Tu pedido {order.orderNumber} está ahora en estado: <b>{statusName}</b>
      </div>
    </div>
  );
}
