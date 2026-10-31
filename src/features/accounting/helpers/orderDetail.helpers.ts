import { money, type OrderEvent, type OrderEventChange } from '@/lib/orders/orderEvents';
import type { Order, OrderStatus } from '@/types';

/** "Domicilio", "Mesa 4" o "Recoger". Pedidos sin deliveryType son para recoger (igual que el tablero). */
export function deliveryLabel(order: Pick<Order, 'deliveryType' | 'tableName'>): string {
  if (order.deliveryType === 'domicilio') return 'Domicilio';
  if (order.deliveryType === 'mesa') return order.tableName ? `Mesa ${order.tableName.replace(/^mesa\s*/i, '')}` : 'Mesa';
  return 'Recoger';
}

export interface TimelineEntry {
  key: string;
  label: string;
  color?: string;
  at: string;
  byName?: string;
  // Lo hizo el sistema (carta, WhatsApp): no hay usuario
  system?: boolean;
  changes?: OrderEventChange[];
  sensitive?: boolean;
}

export interface OrderTimeline {
  entries: TimelineEntry[];
  // false = pedido anterior a la auditoría: solo se conoce lo que quedó en el pedido (creación, pagos…)
  hasHistory: boolean;
  deliveredAt?: string;
  // Milisegundos entre la creación y el estado "Entregado"
  fulfillmentMs?: number;
}

/**
 * Auditoría del pedido en orden cronológico: estados (statusHistory) + eventos (orders/{id}/events).
 * En pedidos anteriores a la auditoría se completa con lo que quedó guardado en el pedido.
 */
export function buildOrderTimeline(order: Order, statuses: OrderStatus[], events: OrderEvent[] = []): OrderTimeline {
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const history = [...(order.statusHistory ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  const has = (type: OrderEvent['type']) => events.some((e) => e.type === type);
  const hasHistory = history.length > 0 || events.length > 0;
  const createdEvent = has('created');

  const entries: TimelineEntry[] = history.map((h, i) => {
    const status = statusById.get(h.statusId);
    const name = status?.name ?? 'Estado eliminado';
    return {
      key: `${h.statusId}-${h.at}`,
      // Si ya hay evento de creación, el primer estado no repite "Pedido creado"
      label: i === 0 && !createdEvent ? `Pedido creado · ${name}` : `Estado: ${name}`,
      color: status?.color,
      at: h.at,
      byName: h.byName,
      system: !h.by,
    };
  });
  if (history.length === 0 && !createdEvent) entries.push({ key: 'created', label: 'Pedido creado', at: order.createdAt });

  for (const e of events) {
    entries.push({
      key: e.id, label: e.summary, at: e.at, byName: e.byName, system: !e.by,
      changes: e.changes, sensitive: e.sensitive,
    });
  }

  // Pedidos anteriores a la auditoría: lo que sí quedó guardado en el pedido
  if (!has('payment_added')) {
    for (const p of order.payments ?? []) {
      entries.push({ key: `pay-${p.id}`, label: `Registró un pago: ${p.method} ${money(p.amount)}${p.label ? ` (${p.label})` : ''}`, at: p.paidAt });
    }
  }
  if (order.tableReleasedAt && !has('table_released')) {
    entries.push({ key: 'released', label: 'Liberó la mesa', at: order.tableReleasedAt });
  }
  if (order.isDeleted && order.deletedAt && !has('deleted')) {
    entries.push({ key: 'deleted', label: `Eliminó el pedido${order.deletedReason ? `: ${order.deletedReason}` : ''}`, at: order.deletedAt, sensitive: true });
  }

  entries.sort((a, b) => a.at.localeCompare(b.at));

  // Si lo marcaron entregado más de una vez (volvió atrás), cuenta la última
  const delivered = [...history].reverse().find((h) => statusById.get(h.statusId)?.code === 'delivered');
  const deliveredAt = delivered?.at;
  const fulfillmentMs = deliveredAt ? new Date(deliveredAt).getTime() - new Date(order.createdAt).getTime() : undefined;

  return { entries, hasHistory, deliveredAt, fulfillmentMs };
}

/** 42 min · 1 h 05 min · 2 d 3 h */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}
