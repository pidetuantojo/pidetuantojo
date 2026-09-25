import type { Order } from '@/types';

export interface OrderTotals {
  // Solo productos (con adicionales)
  productsTotal: number;
  // Valor del domicilio (0 si no aplica o aún no se definió)
  deliveryFee: number;
  // Productos + domicilio
  total: number;
}

/**
 * Convención de montos de un pedido:
 *   subtotal    = solo productos
 *   deliveryFee = valor del domicilio
 *   total       = subtotal + deliveryFee
 * Se calcula desde `subtotal` y `deliveryFee` (no desde `total`) para no sumar el domicilio dos veces.
 */
export function getOrderTotals(order: Pick<Order, 'subtotal' | 'deliveryFee'>): OrderTotals {
  const productsTotal = order.subtotal;
  const deliveryFee = order.deliveryFee ?? 0;
  return { productsTotal, deliveryFee, total: productsTotal + deliveryFee };
}
