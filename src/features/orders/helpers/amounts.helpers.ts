import type { Order, OrderItem } from '@/types';

type AmountsSource = Pick<Order, 'items' | 'discount' | 'deliveryFee'>;

export interface OrderAmounts {
  subtotal: number;
  discount: number;
  total: number;
}

function lineDiscounts(items: OrderItem[]): number {
  return items.reduce((s, i) => s + (i.discount ?? 0), 0);
}

/** Precio de lista de una línea: (unitario + adicionales) × cantidad. */
export function lineSubtotal(item: Pick<OrderItem, 'unitPrice' | 'additionals' | 'quantity'>): number {
  const additionals = item.additionals.reduce((s, a) => s + a.price, 0);
  return (item.unitPrice + additionals) * item.quantity;
}

/**
 * Recalcula montos tras cambiar los productos (quitar, trasladar).
 * Se conservan los descuentos de las líneas que quedan y los descuentos al total del pedido
 * (promociones al total + descuento manual), igual que en EditOrderModal.
 */
export function recalcAmounts(order: AmountsSource, items: OrderItem[]): OrderAmounts {
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const orderLevel = Math.max(0, (order.discount ?? 0) - lineDiscounts(order.items));
  const discount = Math.min(subtotal, orderLevel + lineDiscounts(items));
  return { subtotal, discount, total: subtotal - discount + (order.deliveryFee ?? 0) };
}

/**
 * Aplica (o cambia) el descuento manual. `discount` = promociones + manual; el manual se
 * limita para que el total de productos nunca quede negativo.
 */
export function applyManualDiscount(
  order: Pick<Order, 'subtotal' | 'discount' | 'manualDiscount' | 'deliveryFee'>,
  amount: number,
): OrderAmounts & { manualDiscount: number } {
  const promotions = Math.max(0, (order.discount ?? 0) - (order.manualDiscount ?? 0));
  const manualDiscount = Math.max(0, Math.min(Math.round(amount), order.subtotal - promotions));
  const discount = promotions + manualDiscount;
  return {
    subtotal: order.subtotal,
    discount,
    manualDiscount,
    total: order.subtotal - discount + (order.deliveryFee ?? 0),
  };
}

/** Descuento manual a partir de un porcentaje de los productos (después de promociones). */
export function percentToAmount(order: Pick<Order, 'subtotal' | 'discount' | 'manualDiscount'>, percent: number): number {
  const promotions = Math.max(0, (order.discount ?? 0) - (order.manualDiscount ?? 0));
  return Math.round(((order.subtotal - promotions) * Math.min(100, Math.max(0, percent))) / 100);
}
