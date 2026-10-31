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
}

export interface OrderTimeline {
  entries: TimelineEntry[];
  // false = pedido anterior al historial: solo se conoce la creación (y la liberación de la mesa)
  hasHistory: boolean;
  deliveredAt?: string;
  // Milisegundos entre la creación y el estado "Entregado"
  fulfillmentMs?: number;
}

export function buildOrderTimeline(order: Order, statuses: OrderStatus[]): OrderTimeline {
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const history = [...(order.statusHistory ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  const hasHistory = history.length > 0;

  const entries: TimelineEntry[] = hasHistory
    ? history.map((h, i) => {
        const status = statusById.get(h.statusId);
        return {
          key: `${h.statusId}-${h.at}`,
          label: i === 0 ? `Pedido creado · ${status?.name ?? 'Recibido'}` : status?.name ?? 'Estado eliminado',
          color: status?.color,
          at: h.at,
          byName: h.byName,
        };
      })
    : [{ key: 'created', label: 'Pedido creado', at: order.createdAt }];

  if (order.tableReleasedAt) {
    entries.push({ key: 'released', label: 'Mesa liberada', at: order.tableReleasedAt });
    entries.sort((a, b) => a.at.localeCompare(b.at));
  }

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
