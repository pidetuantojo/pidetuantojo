import type { Order } from '@/types';

export interface OrderTotals {
  // Solo productos (con adicionales), a precio de lista
  productsTotal: number;
  // Descuentos de promociones y fidelidad (0 si no hay)
  discount: number;
  // Valor del domicilio (0 si no aplica, aún no se definió o es gratis por promoción)
  deliveryFee: number;
  // Productos − descuentos + domicilio
  total: number;
}

/**
 * Convención de montos de un pedido:
 *   subtotal    = solo productos (precio de lista)
 *   discount    = promociones y fidelidad
 *   deliveryFee = valor del domicilio
 *   total       = subtotal − discount + deliveryFee
 * Se calcula desde las partes (no desde `total`) para no sumar el domicilio dos veces.
 */
export function getOrderTotals(order: Pick<Order, 'subtotal' | 'deliveryFee' | 'discount'>): OrderTotals {
  const productsTotal = order.subtotal;
  const discount = Math.min(order.discount ?? 0, productsTotal);
  const deliveryFee = order.deliveryFee ?? 0;
  return { productsTotal, discount, deliveryFee, total: productsTotal - discount + deliveryFee };
}
