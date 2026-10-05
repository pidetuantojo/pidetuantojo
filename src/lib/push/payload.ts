// Contenido de los avisos push (lógica pura). El service worker (public/sw.js) los muestra.
import type { OrderDeliveryType } from '@/types';

export const ORDERS_PATH = '/dashboard/pedidos';

/** Datos que viajan en el push. FCM exige que todos los valores sean string. */
export interface PushData {
  kind: 'new_order' | 'test';
  title: string;
  body: string;
  // A dónde lleva el toque en la notificación
  url: string;
  // Agrupa: un mismo pedido no aparece dos veces
  tag: string;
  orderId?: string;
}

const DELIVERY_LABEL: Record<OrderDeliveryType, string> = {
  domicilio: 'Domicilio',
  recoger: 'Recoger',
  mesa: 'En el local',
};

function money(amount: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
    .format(amount)
    .replace(/\s/g, '');
}

export interface NewOrderInfo {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  deliveryType?: OrderDeliveryType;
  tableName?: string;
  isScheduled?: boolean;
}

/** "🛎 Nuevo pedido #123456" — "Juan · $45.000 · Domicilio" */
export function buildNewOrderPush(order: NewOrderInfo): PushData {
  const delivery = order.deliveryType
    ? `${DELIVERY_LABEL[order.deliveryType]}${order.deliveryType === 'mesa' && order.tableName ? ` (${order.tableName})` : ''}`
    : '';
  const parts = [order.customerName.trim(), money(order.total), delivery, order.isScheduled ? 'Programado' : ''].filter(Boolean);
  return {
    kind: 'new_order',
    title: `🛎 Nuevo pedido ${order.orderNumber}`,
    body: parts.join(' · '),
    url: `${ORDERS_PATH}?pedido=${encodeURIComponent(order.id)}`,
    tag: `order-${order.id}`,
    orderId: order.id,
  };
}

export function buildTestPush(): PushData {
  return {
    kind: 'test',
    title: '🔔 Avisos de pedidos activos',
    body: 'Así te vamos a avisar cuando entre un pedido, aunque la app esté cerrada.',
    url: ORDERS_PATH,
    tag: 'test',
  };
}

/** FCM solo acepta valores string en `data`. */
export function toFcmData(data: PushData): Record<string, string> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
}

// Errores de FCM que significan "este token ya no sirve": se borra
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export function isInvalidTokenError(code: string | undefined): boolean {
  return !!code && INVALID_TOKEN_CODES.has(code);
}
