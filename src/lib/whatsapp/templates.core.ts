// Plantillas de WhatsApp: tipos, valores por defecto y reglas puras.
// Sin Firebase: lo usan el panel (cliente) y /api/orders (servidor).

import { getOrderTotals } from '@/features/orders/helpers/totals.helpers';
import type { Order, OrderDeliveryType, OrderStatus } from '@/types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type WaEventCode = 'pedido_nuevo' | 'pedido_confirmado' | 'pedido_en_camino' | 'pedido_entregado' | 'pedido_estado_actualizado' | 'pedido_pagado';

export interface WaEventMeta {
  code: WaEventCode;
  label: string;
  emoji: string;
  description: string;
}

export type WaTemplates = Record<WaEventCode, string>;

/** Plantilla creada por el restaurante. Se asocia a estados desde el formulario del estado. */
export interface CustomWaTemplate {
  id: string;
  name: string;
  body: string;
  createdAt: string;
}

export interface WaTemplateStore {
  system: WaTemplates;
  custom: CustomWaTemplate[];
}

/** Datos con los que se rellena una plantilla. */
export interface WaTemplateData {
  customerName?: string;
  orderNumber?: string;
  total?: number;
  // Desglose del total: productos (precio de lista) − descuento + domicilio
  subtotal?: number;
  discount?: number;
  deliveryType?: OrderDeliveryType;
  // undefined en domicilio = aún no se definió el valor
  deliveryFee?: number;
  freeDelivery?: boolean;
  paymentMethod?: string;
  items?: { productName: string; quantity: number }[];
  statusName?: string;
}

/** Datos de la plantilla a partir del pedido guardado (montos con getOrderTotals). */
export function templateDataFromOrder(
  order: Pick<Order, 'customerName' | 'orderNumber' | 'subtotal' | 'discount' | 'deliveryFee' | 'freeDelivery' | 'deliveryType' | 'paymentMethod' | 'items'>,
  statusName?: string,
): WaTemplateData {
  const totals = getOrderTotals(order);
  return {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    subtotal: totals.productsTotal,
    discount: totals.discount,
    deliveryType: order.deliveryType ?? 'recoger',
    deliveryFee: order.deliveryFee,
    freeDelivery: order.freeDelivery,
    total: totals.total,
    paymentMethod: order.paymentMethod,
    items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
    statusName,
  };
}

// ─── Metadata de eventos ──────────────────────────────────────────────────────

export const WA_EVENTS: WaEventMeta[] = [
  { code: 'pedido_nuevo',              label: 'Pedido nuevo',              emoji: '🆕', description: 'Por defecto: estado "Recibido" (cuando llega un pedido nuevo)' },
  { code: 'pedido_confirmado',         label: 'Pedido confirmado',         emoji: '✅', description: 'Por defecto: estado "Confirmado"' },
  { code: 'pedido_en_camino',          label: 'Pedido en camino',          emoji: '🚀', description: 'Por defecto: estado "En camino"' },
  { code: 'pedido_entregado',          label: 'Pedido entregado',          emoji: '✔️', description: 'Por defecto: estado "Entregado"' },
  { code: 'pedido_estado_actualizado', label: 'Estado actualizado (general)', emoji: '📦', description: 'Por defecto: los demás estados. Usa el campo "Estado del pedido"' },
  { code: 'pedido_pagado',             label: 'Pedido pagado',             emoji: '💳', description: 'Cuando el pedido se marca como pagado (no es un estado)' },
];

// ─── Plantillas por defecto ───────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: WaTemplates = {
  pedido_nuevo: `Hola {{nombreCliente}}! 👋\nTu pedido *#{{numeroPedido}}* fue recibido ✅\n\n*🛒 Productos:*\n{{productos}}\n\n{{resumenPago}}\n*💳 Pago:* {{metodoPago}}`,
  pedido_confirmado: `Hola {{nombreCliente}}! 👋\nTu pedido *#{{numeroPedido}}* fue *confirmado* ✅\n\n*🛒 Productos:*\n{{productos}}\n\n{{resumenPago}}\n*💳 Pago:* {{metodoPago}}`,
  pedido_en_camino: `Hola {{nombreCliente}}! 🚀\nTu pedido *#{{numeroPedido}}* está *en camino* 🛵\n\n¡Prepárate para recibirlo!`,
  pedido_entregado: `Hola {{nombreCliente}}! ✔️\nTu pedido *#{{numeroPedido}}* fue *entregado*.\n\n¡Gracias por tu pedido! 🙌`,
  pedido_estado_actualizado: `Hola {{nombreCliente}}! 📦\nTu pedido *#{{numeroPedido}}* ahora está: *{{estadoPedido}}*`,
  pedido_pagado: `Hola {{nombreCliente}}! 💳\nTu pedido *#{{numeroPedido}}* ya fue *pagado* ✅\n\n{{resumenPago}}\n*💳 Pago:* {{metodoPago}}\n\n¡Gracias por tu pedido! 🙌`,
};

// ─── Campos disponibles ───────────────────────────────────────────────────────

export const TEMPLATE_VARS = [
  { key: '{{nombreCliente}}', label: 'Nombre del cliente' },
  { key: '{{numeroPedido}}',  label: 'Número de pedido' },
  { key: '{{resumenPago}}',   label: 'Resumen de pago' },
  { key: '{{total}}',         label: 'Total' },
  { key: '{{valorProductos}}', label: 'Valor de los productos' },
  { key: '{{descuento}}',     label: 'Descuento' },
  { key: '{{domicilio}}',     label: 'Valor del domicilio' },
  { key: '{{metodoPago}}',    label: 'Método de pago' },
  { key: '{{productos}}',     label: 'Lista de productos' },
  { key: '{{estadoPedido}}',  label: 'Estado del pedido' },
];

// ─── Estado → plantilla ───────────────────────────────────────────────────────

const GENERIC_TEMPLATE: WaEventCode = 'pedido_estado_actualizado';

// Plantilla por defecto de cada código (antes de que el estado tenga una elegida).
// "En camino" no es estado base: se crea a mano y su code sale del nombre (slugify → "en_camino").
export const STATUS_TO_EVENT: Record<string, WaEventCode> = {
  received:   'pedido_nuevo',
  confirmed:  'pedido_confirmado',
  on_the_way: 'pedido_en_camino',
  en_camino:  'pedido_en_camino',
  delivered:  'pedido_entregado',
  paid:       'pedido_pagado',
};

// Por defecto no avisan (hasta que el restaurante active el aviso en el estado)
const SILENT_BY_DEFAULT = new Set(['cancelled']);

export const DELIVERY_KINDS: { value: OrderDeliveryType; label: string; emoji: string }[] = [
  { value: 'recoger',   label: 'Para llevar', emoji: '🛍️' },
  { value: 'domicilio', label: 'Domicilio',   emoji: '🛵' },
  { value: 'mesa',      label: 'Mesa',        emoji: '🍽️' },
];

type StatusNotifyFields = Pick<OrderStatus, 'code' | 'notifyByDelivery' | 'notifyCustomer' | 'waTemplateId'>;

/**
 * ¿Este estado le avisa al cliente en este método de entrega?
 * Sin configurar: mesa nunca; para llevar y domicilio, todos menos "Cancelado".
 */
export function statusNotifies(status: StatusNotifyFields, deliveryType: OrderDeliveryType): boolean {
  const explicit = status.notifyByDelivery?.[deliveryType];
  if (explicit !== undefined) return explicit;
  if (deliveryType === 'mesa') return false;
  return status.notifyCustomer ?? !SILENT_BY_DEFAULT.has(status.code);
}

/** ¿Avisa en al menos un método de entrega? */
export function statusNotifiesAny(status: StatusNotifyFields): boolean {
  return DELIVERY_KINDS.some((k) => statusNotifies(status, k.value));
}

/** Plantilla elegida para el estado, o la que le toca por su código. */
export function statusTemplateChoice(status: StatusNotifyFields): string {
  return status.waTemplateId || STATUS_TO_EVENT[status.code] || GENERIC_TEMPLATE;
}

/** Plantilla a enviar al pasar a este estado en ese método de entrega; null si no avisa. */
export function statusTemplateId(status: StatusNotifyFields, deliveryType: OrderDeliveryType): string | null {
  return statusNotifies(status, deliveryType) ? statusTemplateChoice(status) : null;
}

function isEventCode(id: string): id is WaEventCode {
  return id in DEFAULT_TEMPLATES;
}

/** Texto de una plantilla. Si la plantilla propia ya no existe, cae en la general. */
export function templateBody(store: WaTemplateStore, id: string): string {
  if (isEventCode(id)) return store.system[id];
  return store.custom.find((t) => t.id === id)?.body ?? store.system[GENERIC_TEMPLATE];
}

export function templateName(store: WaTemplateStore, id: string): string {
  if (isEventCode(id)) return WA_EVENTS.find((e) => e.code === id)?.label ?? id;
  return store.custom.find((t) => t.id === id)?.name ?? 'Estado actualizado (general)';
}

/**
 * Documento settings/waTemplates: las del sistema en el primer nivel (formato original)
 * y las propias en el mapa `custom` ({ [id]: { name, body, createdAt } }).
 */
export function parseTemplateStore(data: Record<string, unknown> | undefined): WaTemplateStore {
  const system = { ...DEFAULT_TEMPLATES };
  for (const code of Object.keys(DEFAULT_TEMPLATES) as WaEventCode[]) {
    if (typeof data?.[code] === 'string') system[code] = data[code] as string;
  }
  const customMap = (data?.custom ?? {}) as Record<string, Omit<CustomWaTemplate, 'id'>>;
  const custom = Object.entries(customMap)
    .map(([id, t]) => ({ id, name: t.name, body: t.body, createdAt: t.createdAt }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { system, custom };
}

// ─── Aplicar campos a una plantilla ───────────────────────────────────────────

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

/** Valor del domicilio para el cliente; vacío si el pedido no es a domicilio. */
function deliveryText(data: WaTemplateData): string {
  if (data.deliveryType !== 'domicilio') return '';
  if (data.freeDelivery) return 'Gratis';
  return data.deliveryFee !== undefined ? formatCOP(data.deliveryFee) : 'Por confirmar';
}

/**
 * Desglose del total. El descuento solo si hubo; el domicilio solo en pedidos a domicilio.
 * Sin desglose (datos antiguos) queda solo el total.
 */
export function paymentSummary(data: WaTemplateData): string {
  if (data.total === undefined) return '';
  const lines: string[] = [];
  if (data.subtotal !== undefined) lines.push(`🧾 Productos: ${formatCOP(data.subtotal)}`);
  if (data.discount) lines.push(`🏷️ Descuento: −${formatCOP(data.discount)}`);
  const delivery = deliveryText(data);
  if (delivery) lines.push(`🛵 Domicilio: ${delivery}`);
  lines.push(`💰 *Total: ${formatCOP(data.total)}*`);
  return lines.join('\n');
}

export function applyTemplate(template: string, data: WaTemplateData): string {
  const products = data.items?.map((i) => `  • ${i.quantity}x ${i.productName}`).join('\n') ?? '';
  return template
    .replace(/{{nombreCliente}}/g, data.customerName ?? '')
    .replace(/{{numeroPedido}}/g, data.orderNumber ?? '')
    .replace(/{{resumenPago}}/g, paymentSummary(data))
    .replace(/{{valorProductos}}/g, data.subtotal !== undefined ? formatCOP(data.subtotal) : '')
    .replace(/{{descuento}}/g, data.discount ? `−${formatCOP(data.discount)}` : formatCOP(0))
    .replace(/{{domicilio}}/g, deliveryText(data) || formatCOP(0))
    .replace(/{{total}}/g, data.total !== undefined ? formatCOP(data.total) : '')
    .replace(/{{metodoPago}}/g, data.paymentMethod ?? '')
    .replace(/{{productos}}/g, products)
    .replace(/{{estadoPedido}}/g, data.statusName ?? '');
}
