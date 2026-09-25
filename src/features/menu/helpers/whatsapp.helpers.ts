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

const SEPARATOR = '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501';

// Emojis como Unicode escapes para evitar que el bundler los corrompa en Windows.
const E = {
  nota:      '\u{1F4DD}', // 📝
  moto:      '\u{1F6F5}', // 🛵
  mesa:      '\u{1FA91}', // 🪑
  recoger:   '\u{1F3C3}', // 🏃
  motoFee:   '\u{1F3CD}', // 🏍
  dinero:    '\u{1F4B0}', // 💰
  recibo:    '\u{1F9FE}', // 🧾
  pin:       '\u{1F4CD}', // 📍
  barrio:    '\u{1F3D8}', // 🏘
  ubicacion: '\u{1F4CC}', // 📌
  reloj:     '\u{23F0}',  // ⏰
  telefono:  '\u{1F4DE}', // 📞
  carrito:   '\u{1F6D2}', // 🛒
  tarjeta:   '\u{1F4B3}', // 💳
  gracias:   '\u{1F64F}', // 🙏
};

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
      let line = `\u2022 ${item.quantity} x ${item.productName} (${money(item.subtotal)})`;
      item.additionals.forEach((a) => {
        line += `\n   + ${a.name} (+${money(a.price)})`;
      });
      if (item.observacion?.trim()) {
        line += `\n   ${E.nota} _Nota: ${item.observacion.trim()}_`;
      }
      return line;
    })
    .join('\n');

  const isDomicilio = checkout.deliveryType === 'domicilio';
  const deliveryLabel =
    isDomicilio
      ? `${E.moto} Domicilio`
      : checkout.deliveryType === 'mesa'
        ? `${E.mesa} Comer en el local${checkout.tableName ? ` \u2014 ${checkout.tableName}` : ''}`
        : `${E.recoger} Recoger en tienda`;

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
              `${E.motoFee} Domicilio${checkout.deliveryZoneName ? ` (${checkout.deliveryZoneName})` : ''}: ${money(checkout.deliveryFee ?? 0)}`,
            ]
          : []),
        `${E.dinero} *Total del pedido: ${money(total)}*`,
      ];

  const lines = [
    ...(checkout.orderNumber ? [`${E.recibo} *Orden ${checkout.orderNumber}*`] : []),
    `Hola *${restaurantName}*, soy *${checkout.customerName.trim()}* y me gustar\u00eda hacer un pedido.`,
    SEPARATOR,
    `*Entrega:* ${deliveryLabel}`,
    ...(isDomicilio && checkout.address ? [`${E.pin} *Direcci\u00f3n:* ${checkout.address}`] : []),
    ...(isDomicilio && checkout.barrio ? [`${E.barrio} *Barrio:* ${checkout.barrio}`] : []),
    ...(checkout.location ? [`${E.ubicacion} *Ubicaci\u00f3n:* https://maps.google.com/?q=${checkout.location.lat},${checkout.location.lng}`] : []),
    ...(checkout.scheduledLabel ? [`${E.reloj} *Programado para:* ${checkout.scheduledLabel}`] : []),
    `${E.telefono} *Celular:* ${formatPhone(checkout.customerPhone)}`,
    SEPARATOR,
    `${E.carrito} *Detalle de la orden:*`,
    itemsText,
    SEPARATOR,
    `${E.tarjeta} *Forma de pago:* ${checkout.paymentLabel}`,
    ...(checkout.paymentAccount ? [checkout.paymentAccount] : []),
    ``,
    ...totalsLines,
    ``,
    `\u00a1Gracias! ${E.gracias}`,
  ];

  return lines.join('\n');
}

export function openWhatsApp(phone: string, message: string): void {
  const cleanPhone = phone.replace(/\D/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  // location.href en vez de window.open para no perder el gesto de usuario
  // en mobile después de un await (Safari iOS, WebViews).
  window.location.href = url;
}
