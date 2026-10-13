'use client';

import { Bike, Clock, LayoutGrid, MapPin, CalendarClock } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import { formatScheduledDate } from '@/features/menu/helpers/schedule.helpers';
import type { OrderStatus } from '@/types';

import { getOrderTotals } from '../../helpers/totals.helpers';
import { timeAgo } from '../../helpers/time.helpers';
import type { OrderCardProps } from './OrderCard.types';

export function StatusBadge({ status }: { status?: OrderStatus }) {
  if (!status) return null;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold leading-tight"
      style={{ backgroundColor: `${status.color}1f`, color: status.color }}
    >
      {status.name}
    </span>
  );
}

function PaidBadge({ isPaid }: { isPaid?: boolean }) {
  return isPaid ? (
    <span className="rounded-full bg-emerald-50 px-1.5 py-px text-[9px] font-bold text-emerald-600">Pagado</span>
  ) : null;
}

/**
 * Tarjeta compacta del tablero: solo lo necesario para reconocer el pedido.
 * Todas las acciones están en el panel lateral que se abre al tocarla.
 */
export function OrderCard({ order, status, selected, finished, onOpen }: OrderCardProps) {
  const { total } = getOrderTotals(order);
  const base = `w-full cursor-pointer rounded-xl border bg-[var(--t-surface)] text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
    selected ? 'border-[#FF6A1A] ring-2 ring-[#FF6A1A]/30' : 'border-[var(--t-border)]'
  } ${finished ? 'opacity-55' : ''}`;

  if (order.deliveryType === 'mesa') {
    return (
      <button type="button" onClick={() => onOpen(order)} className={`${base} flex flex-col items-center gap-1 px-3 py-3 text-center`}>
        <LayoutGrid className="h-5 w-5 text-emerald-600" />
        <span className="text-sm font-extrabold uppercase tracking-wide text-emerald-600">
          {order.tableName ?? 'Mesa'}
        </span>
        <span className="text-xs font-semibold text-[var(--t-text-1)]">Comanda {order.orderNumber}</span>
        {order.customerName && (
          <span className="max-w-full truncate text-[10px] text-[var(--t-text-4)]">{order.customerName}</span>
        )}
        <StatusBadge status={status} />
        <span className="text-sm font-extrabold text-[var(--t-text-1)]">{formatCurrency(total)}</span>
        <span className="flex items-center gap-1 text-[10px] text-[var(--t-text-4)]">
          <Clock className="h-3 w-3" /> {timeAgo(order.createdAt)}
        </span>
        <PaidBadge isPaid={order.isPaid} />
      </button>
    );
  }

  const isDomicilio = order.deliveryType === 'domicilio';
  return (
    <button type="button" onClick={() => onOpen(order)} className={`${base} block space-y-1.5 px-3 py-2.5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold text-[var(--t-text-1)]">#{order.orderNumber}</span>
        <StatusBadge status={status} />
      </div>
      <p className="truncate text-sm font-semibold text-[var(--t-text-1)]">{order.customerName}</p>
      {isDomicilio && order.customerAddress && (
        <p className="flex items-start gap-1 text-[11px] text-[var(--t-text-3)]">
          <MapPin className="mt-px h-3 w-3 flex-shrink-0" />
          <span className="line-clamp-1">{order.customerAddress}{order.barrio ? ` — ${order.barrio}` : ''}</span>
        </p>
      )}
      {isDomicilio && order.assignedDriver && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600">
          <Bike className="h-3 w-3" /> <span className="truncate">{order.assignedDriver.courierName ?? order.assignedDriver.name}</span>
        </p>
      )}
      {order.isScheduled && order.scheduledFor && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-violet-600">
          <CalendarClock className="h-3 w-3" /> {formatScheduledDate(new Date(order.scheduledFor))}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="flex items-center gap-1 text-[10px] text-[var(--t-text-4)]">
          <Clock className="h-3 w-3" /> {timeAgo(order.createdAt)}
          <PaidBadge isPaid={order.isPaid} />
        </span>
        <span className="text-sm font-extrabold text-[var(--t-text-1)]">{formatCurrency(total)}</span>
      </div>
    </button>
  );
}
