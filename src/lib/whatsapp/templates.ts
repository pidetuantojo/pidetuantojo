import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { WaNotifyData } from '@/features/orders/hooks/useUpdateOrderStatus';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type WaEventCode = 'pedido_nuevo' | 'pedido_confirmado' | 'pedido_en_camino' | 'pedido_entregado';

export interface WaEventMeta {
  code: WaEventCode;
  label: string;
  emoji: string;
  description: string;
}

export type WaTemplates = Record<WaEventCode, string>;

// ─── Metadata de eventos ──────────────────────────────────────────────────────

export const WA_EVENTS: WaEventMeta[] = [
  { code: 'pedido_nuevo',       label: 'Pedido nuevo',      emoji: '🆕', description: 'Se envía cuando llega un pedido nuevo' },
  { code: 'pedido_confirmado',  label: 'Pedido confirmado', emoji: '✅', description: 'Se envía cuando el admin confirma el pedido' },
  { code: 'pedido_en_camino',   label: 'Pedido en camino',  emoji: '🚀', description: 'Se envía cuando el pedido pasa a "en camino"' },
  { code: 'pedido_entregado',   label: 'Pedido entregado',  emoji: '✔️', description: 'Se envía cuando el pedido es entregado' },
];

// ─── Plantillas por defecto ───────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: WaTemplates = {
  pedido_nuevo: `Hola {{nombreCliente}}! 👋\nTu pedido *#{{numeroPedido}}* fue recibido ✅\n\n*🛒 Productos:*\n{{productos}}\n\n*💰 Total:* {{total}}\n*💳 Pago:* {{metodoPago}}`,
  pedido_confirmado: `Hola {{nombreCliente}}! 👋\nTu pedido *#{{numeroPedido}}* fue *confirmado* ✅\n\n*🛒 Productos:*\n{{productos}}\n\n*💰 Total:* {{total}}\n*💳 Pago:* {{metodoPago}}`,
  pedido_en_camino: `Hola {{nombreCliente}}! 🚀\nTu pedido *#{{numeroPedido}}* está *en camino* 🛵\n\n¡Preparate para recibirlo!`,
  pedido_entregado: `Hola {{nombreCliente}}! ✔️\nTu pedido *#{{numeroPedido}}* fue *entregado*.\n\n¡Gracias por tu pedido! 🙌`,
};

// ─── Variables disponibles ────────────────────────────────────────────────────

export const TEMPLATE_VARS = [
  { key: '{{nombreCliente}}',  label: 'Nombre del cliente' },
  { key: '{{numeroPedido}}',   label: 'Número de pedido' },
  { key: '{{total}}',          label: 'Total (COP)' },
  { key: '{{metodoPago}}',     label: 'Método de pago' },
  { key: '{{productos}}',      label: 'Lista de productos' },
];

// ─── Firestore helpers ────────────────────────────────────────────────────────

function templatesRef(restaurantId: string) {
  return doc(db, 'restaurants', restaurantId, 'settings', 'waTemplates');
}

export async function getWaTemplates(restaurantId: string): Promise<WaTemplates> {
  const snap = await getDoc(templatesRef(restaurantId));
  if (!snap.exists()) return { ...DEFAULT_TEMPLATES };
  return { ...DEFAULT_TEMPLATES, ...snap.data() } as WaTemplates;
}

export async function saveWaTemplates(restaurantId: string, templates: Partial<WaTemplates>): Promise<void> {
  await setDoc(templatesRef(restaurantId), templates, { merge: true });
}

// ─── Aplicar variables a una plantilla ────────────────────────────────────────

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

export function applyTemplate(template: string, data: Partial<WaNotifyData>): string {
  const products = data.items?.map((i) => `  • ${i.quantity}x ${i.productName}`).join('\n') ?? '';
  return template
    .replace(/{{nombreCliente}}/g, data.customerName ?? '')
    .replace(/{{numeroPedido}}/g, data.orderNumber ?? '')
    .replace(/{{total}}/g, data.total !== undefined ? formatCOP(data.total) : '')
    .replace(/{{metodoPago}}/g, data.paymentMethod ?? '')
    .replace(/{{productos}}/g, products);
}
