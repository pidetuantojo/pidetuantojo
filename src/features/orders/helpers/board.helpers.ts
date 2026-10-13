import type { Order, OrderDeliveryType, OrderStatus } from '@/types';

export type BoardColumnKey = OrderDeliveryType;

/** Pedidos viejos sin tipo de entrega se tratan como "para llevar". */
export function getBoardColumn(order: Pick<Order, 'deliveryType'>): BoardColumnKey {
  return order.deliveryType ?? 'recoger';
}

/**
 * ¿El pedido ya salió del tablero?
 * - Cancelado: siempre.
 * - Mesa: cuando se libera la mesa (puede estar entregado y seguir ocupando la mesa hasta pagar).
 * - Para llevar / domicilio: al quedar entregado.
 */
export function isOrderFinished(
  order: Pick<Order, 'statusId' | 'deliveryType' | 'tableReleasedAt'>,
  statuses: Pick<OrderStatus, 'id' | 'code'>[],
): boolean {
  const code = statuses.find((s) => s.id === order.statusId)?.code;
  if (code === 'cancelled') return true;
  if (getBoardColumn(order) === 'mesa') return !!order.tableReleasedAt;
  return code === 'delivered';
}

/** Mesas ocupadas por pedidos activos: tableId → pedido. */
export function getOccupiedTables<T extends Pick<Order, 'tableId' | 'statusId' | 'deliveryType' | 'tableReleasedAt'>>(
  orders: T[],
  statuses: Pick<OrderStatus, 'id' | 'code'>[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const o of orders) {
    if (getBoardColumn(o) === 'mesa' && o.tableId && !isOrderFinished(o, statuses)) map.set(o.tableId, o);
  }
  return map;
}
