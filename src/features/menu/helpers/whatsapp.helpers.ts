import type { CartItem } from '@/store/cart.store';
import { formatCurrency } from '@/lib/utils';

export type DeliveryType = 'domicilio' | 'recoger' | 'mesa' | '';
// id del método de pago configurado por el restaurante ('' = sin elegir)
export type PaymentMethod = string;

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
  // Suma de productos (sin domicilio)
  subtotal: number;
  // Valor del domicilio ya conocido (modo zonas) y nombre de la zona
  deliveryFee?: number;
  deliveryZoneName?: string;
}

// Solo caracteres del plano básico de Unicode: los emojis como 🍽️ 👤 📱 llegan como "�"
// en algunos clientes de WhatsApp al abrir el link wa.me.
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

export function buildWhatsAppMessage(
  restaurantName: string,
  items: CartItem[],
  checkout: CheckoutData
): string {
  const itemsText = items
    .map((item) => {
      let line = `- ${item.quantity} x ${item.productName} (${money(item.subtotal)})`;
      item.additionals.forEach((a) => {
        line += `\n   + ${a.name} (+${money(a.price)})`;
      });
      if (item.observacion?.trim()) {
        line += `\n   _Nota: ${item.observacion.trim()}_`;
      }
      return line;
    })
    .join('\n');

  const isDomicilio = checkout.deliveryType === 'domicilio';
  const deliveryLabel =
    isDomicilio
      ? 'Domicilio'
      : checkout.deliveryType === 'mesa'
        ? `Comer en el local${checkout.tableName ? ` — ${checkout.tableName}` : ''}`
        : 'Recoger en tienda';

  const feePending = isDeliveryFeePending(checkout.deliveryType, checkout.deliveryFee);
  const hasFee = isDomicilio && checkout.deliveryFee !== undefined;
  const total = checkout.subtotal + (hasFee ? checkout.deliveryFee ?? 0 : 0);

  const totalsLines = feePending
    ? [
        `*Subtotal del pedido: ${money(checkout.subtotal)}*`,
        `_El valor del domicilio se confirma por este chat._`,
      ]
    : [
        ...(hasFee
          ? [
              `Subtotal: ${money(checkout.subtotal)}`,
              `Domicilio${checkout.deliveryZoneName ? ` (${checkout.deliveryZoneName})` : ''}: ${money(checkout.deliveryFee ?? 0)}`,
            ]
          : []),
        `*Total del pedido: ${money(total)}*`,
      ];

  const lines = [
    ...(checkout.orderNumber ? [`*Orden ${checkout.orderNumber}*`] : []),
    `Hola *${restaurantName}*, soy *${checkout.customerName.trim()}* y me gustaría hacer un pedido.`,
    SEPARATOR,
    `*Entrega:* ${deliveryLabel}`,
    ...(isDomicilio && checkout.address ? [`*Dirección:* ${checkout.address}`] : []),
    ...(isDomicilio && checkout.barrio ? [`*Barrio:* ${checkout.barrio}`] : []),
    ...(checkout.location ? [`*Ubicación:* https://maps.google.com/?q=${checkout.location.lat},${checkout.location.lng}`] : []),
    ...(checkout.scheduledLabel ? [`*Programado para:* ${checkout.scheduledLabel}`] : []),
    `*Celular:* ${formatPhone(checkout.customerPhone)}`,
    SEPARATOR,
    `*Detalle de la orden:*`,
    itemsText,
    SEPARATOR,
    `*Forma de pago:* ${checkout.paymentLabel}`,
    ...(checkout.paymentAccount ? [checkout.paymentAccount] : []),
    ``,
    ...totalsLines,
    ``,
    `Gracias.`,
  ];

  return lines.join('\n');
}

export function openWhatsApp(phone: string, message: string): void {
  const cleanPhone = phone.replace(/\D/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}
