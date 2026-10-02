import type { AppliedPromotion } from '@/types';
import { formatCurrency } from '@/lib/utils';

export type DeliveryType = 'domicilio' | 'recoger' | 'mesa' | '';
// id del método de pago configurado por el restaurante ('' = sin elegir)
export type PaymentMethod = string;

/** Línea del mensaje: sirve para los items del carrito y para los del pedido que devuelve el servidor. */
export interface WhatsAppItem {
  quantity: number;
  productName: string;
  // Precio de lista de la línea (con adicionales)
  subtotal: number;
  additionals: { name: string; price: number }[];
  observacion?: string;
  specialInstructions?: string;
  // Promociones
  discount?: number;
  promotionName?: string;
  isGift?: boolean;
}

interface CheckoutData {
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryType;
  address?: string;
  barrio?: string;
  tableName?: string;
  scheduledLabel?: string;
  // Etiqueta visible (ej: "Nequi") y cuenta a la que se transfiere, si aplica
  paymentLabel: string;
  paymentAccount?: string;
  location?: { lat: number; lng: number };
  // Suma de productos a precio de lista (sin domicilio)
  subtotal: number;
  // Descuentos de promociones y fidelidad (ya calculados por el servidor)
  discount?: number;
  promotions?: AppliedPromotion[];
  // Valor del domicilio ya conocido (modo zonas o gratis por promoción) y nombre de la zona
  deliveryFee?: number;
  deliveryZoneName?: string;
  freeDelivery?: boolean;
}

const SEPARATOR = '━━━━━━━━━━━━━━━━━━━';

/** Sin espacio entre "$" y el número: "$15.000" (Intl usa un espacio no separable). */
function money(amount: number): string {
  return formatCurrency(amount).replace(/\s/g, '');
}

/** "3006664779" → "(300) 666-4779"; cualquier otro formato se deja como está. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10) return phone.trim();
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * El pedido muestra "Subtotal" solo cuando es a domicilio y todavía no se conoce el valor del envío;
 * en cualquier otro caso (recoger, en el local, o domicilio con valor definido) es el "Total".
 */
export function isDeliveryFeePending(deliveryType: DeliveryType, deliveryFee?: number): boolean {
  return deliveryType === 'domicilio' && deliveryFee === undefined;
}

function itemLine(item: WhatsAppItem): string {
  if (item.isGift) {
    return `• 🎁 ${item.quantity} x ${item.productName} (*Regalo*${item.promotionName ? ` — ${item.promotionName}` : ''})`;
  }
  let line = `• ${item.quantity} x ${item.productName} (${money(item.subtotal)})`;
  item.additionals.forEach((a) => {
    line += `\n   + ${a.name} (+${money(a.price)})`;
  });
  if (item.discount) {
    line += `\n   🏷 _${item.promotionName ?? 'Promoción'}: −${money(item.discount)}_`;
  }
  const note = item.observacion?.trim() || item.specialInstructions?.trim();
  if (note) {
    line += `\n   📝 _Nota: ${note}_`;
  }
  return line;
}

export function buildWhatsAppMessage(
  restaurantName: string,
  items: WhatsAppItem[],
  checkout: CheckoutData
): string {
  const itemsText = items.map(itemLine).join('\n');

  const isDomicilio = checkout.deliveryType === 'domicilio';
  const deliveryLabel =
    isDomicilio
      ? '🛵 Domicilio'
      : checkout.deliveryType === 'mesa'
        ? `🪑 Comer en el local${checkout.tableName ? ` — ${checkout.tableName}` : ''}`
        : '🏃 Recoger en tienda';

  const discount = checkout.discount ?? 0;
  const afterDiscount = checkout.subtotal - discount;
  const feePending = isDeliveryFeePending(checkout.deliveryType, checkout.deliveryFee);
  const hasFee = isDomicilio && checkout.deliveryFee !== undefined;
  const total = afterDiscount + (hasFee ? checkout.deliveryFee ?? 0 : 0);

  // Descuentos al total y premio de fidelidad (los de cada producto ya salen en su línea)
  const orderDiscountLines = (checkout.promotions ?? [])
    .filter((p) => (p.type === 'order_discount' || p.type === 'loyalty') && p.amount > 0)
    .map((p) => `🏷 ${p.type === 'loyalty' ? 'Premio de fidelidad' : p.name}${p.couponCode ? ` (cupón ${p.couponCode})` : ''}: −${money(p.amount)}`);

  const discountLines = discount > 0
    ? [
        `Productos: ${money(checkout.subtotal)}`,
        ...orderDiscountLines,
        `Descuentos: −${money(discount)}`,
      ]
    : [];

  const deliveryFeeLine = checkout.freeDelivery
    ? `🏍 Domicilio${checkout.deliveryZoneName ? ` (${checkout.deliveryZoneName})` : ''}: *GRATIS* 🎉`
    : `🏍 Domicilio${checkout.deliveryZoneName ? ` (${checkout.deliveryZoneName})` : ''}: ${money(checkout.deliveryFee ?? 0)}`;

  const totalsLines = feePending
    ? [
        ...discountLines,
        `*Subtotal del pedido: ${money(afterDiscount)}*`,
        `_El valor del domicilio se confirma por este chat._`,
      ]
    : [
        ...(discount > 0 ? discountLines : hasFee ? [`Subtotal: ${money(checkout.subtotal)}`] : []),
        ...(hasFee ? [deliveryFeeLine] : []),
        `💰 *Total del pedido: ${money(total)}*`,
      ];

  const lines = [
    ...(checkout.orderNumber ? [`🧾 *Orden ${checkout.orderNumber}*`] : []),
    `Hola *${restaurantName}*, soy *${checkout.customerName.trim()}* y me gustaría hacer un pedido.`,
    SEPARATOR,
    `*Entrega:* ${deliveryLabel}`,
    ...(isDomicilio && checkout.address ? [`📍 *Dirección:* ${checkout.address}`] : []),
    ...(isDomicilio && checkout.barrio ? [`🏘 *Barrio:* ${checkout.barrio}`] : []),
    ...(checkout.location ? [`📌 *Ubicación:* https://maps.google.com/?q=${checkout.location.lat},${checkout.location.lng}`] : []),
    ...(checkout.scheduledLabel ? [`⏰ *Programado para:* ${checkout.scheduledLabel}`] : []),
    `📞 *Celular:* ${formatPhone(checkout.customerPhone)}`,
    SEPARATOR,
    `🛒 *Detalle de la orden:*`,
    itemsText,
    SEPARATOR,
    `💳 *Forma de pago:* ${checkout.paymentLabel}`,
    ...(checkout.paymentAccount ? [checkout.paymentAccount] : []),
    ``,
    ...totalsLines,
    ``,
    `¡Gracias! 🙏`,
  ];

  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
