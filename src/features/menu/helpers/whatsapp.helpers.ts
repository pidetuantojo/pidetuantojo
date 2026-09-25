import type { CartItem } from '@/store/cart.store';
import { formatCurrency } from '@/lib/utils';

export type DeliveryType = 'domicilio' | 'recoger' | 'mesa' | '';
export type PaymentMethod = 'transferencia' | 'efectivo' | '';

interface CheckoutData {
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryType;
  address?: string;
  barrio?: string;
  tableName?: string;
  paymentMethod: PaymentMethod;
  location?: { lat: number; lng: number };
}

export function buildWhatsAppMessage(
  restaurantName: string,
  items: CartItem[],
  total: number,
  checkout: CheckoutData
): string {
  const itemsText = items
    .map((item) => {
      let line = `• ${item.quantity}× ${item.productName} — ${formatCurrency(item.subtotal)}`;
      if (item.additionals.length > 0) {
        item.additionals.forEach((a) => {
          line += `\n  ↳ ${a.name} (+${formatCurrency(a.price)})`;
        });
      }
      if (item.observacion?.trim()) {
        line += `\n  📝 ${item.observacion.trim()}`;
      }
      return line;
    })
    .join('\n');

  const paymentLabel = checkout.paymentMethod === 'transferencia' ? '💳 Transferencia' : '💵 Efectivo';
  const deliveryLabel =
    checkout.deliveryType === 'domicilio'
      ? '🚚 Domicilio'
      : checkout.deliveryType === 'mesa'
        ? `🪑 Comer en el local${checkout.tableName ? ` — ${checkout.tableName}` : ''}`
        : '🏪 Recoger en tienda';

  const lines = [
    `🍽️ *Nuevo pedido — ${restaurantName}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    itemsText,
    `━━━━━━━━━━━━━━━━━━━`,
    `👤 *Cliente:* ${checkout.customerName}`,
    `📱 *Celular:* ${checkout.customerPhone}`,
    `📦 *Entrega:* ${deliveryLabel}`,
    ...(checkout.deliveryType === 'domicilio' && checkout.address ? [`🏠 *Dirección:* ${checkout.address}`] : []),
    ...(checkout.deliveryType === 'domicilio' && checkout.barrio ? [`📍 *Barrio:* ${checkout.barrio}`] : []),
    ...(checkout.location ? [`📌 *Ubicación:* https://maps.google.com/?q=${checkout.location.lat},${checkout.location.lng}`] : []),
    `━━━━━━━━━━━━━━━━━━━`,
    `*Subtotal: ${formatCurrency(total)}*`,
    `*Pago: ${paymentLabel}*`,
    ``,
    `Confirmo mi pedido 🙌`,
  ].join('\n');

  return lines;
}

export function openWhatsApp(phone: string, message: string): void {
  const cleanPhone = phone.replace(/\D/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}
