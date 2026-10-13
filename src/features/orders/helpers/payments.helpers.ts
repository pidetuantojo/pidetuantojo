import type { Order, OrderPayment } from '@/types';

import { getOrderTotals } from './totals.helpers';

type PaymentsSource = Pick<Order, 'subtotal' | 'discount' | 'deliveryFee' | 'payments'>;

export function paidAmount(order: Pick<Order, 'payments'>): number {
  return (order.payments ?? []).reduce((s, p) => s + p.amount, 0);
}

/** Lo que falta por pagar (nunca negativo). */
export function remainingAmount(order: PaymentsSource): number {
  return Math.max(0, getOrderTotals(order).total - paidAmount(order));
}

export function isFullyPaid(order: PaymentsSource): boolean {
  return remainingAmount(order) === 0 && paidAmount(order) > 0;
}

/** Divide en partes iguales en pesos enteros: el sobrante se reparte en las primeras partes. */
export function splitEvenly(amount: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  const base = Math.floor(amount / n);
  const extra = amount - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Cambio a devolver en efectivo. */
export function changeFor(amount: number, received: number): number {
  return Math.max(0, received - amount);
}

export function createPaymentId(): string {
  return `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Mensaje de WhatsApp para el cliente con el estado del pago: lo pendiente (y la cuenta a la
 * que puede transferir) o la confirmación si ya pagó.
 */
export function buildPaymentMessage(
  order: Pick<Order, 'customerName' | 'orderNumber' | 'paymentMethod' | 'paymentAccount' | 'isPaid'> & PaymentsSource,
): string {
  const money = (n: number) => `$${n.toLocaleString('es-CO')}`;
  const pending = remainingAmount(order);
  if (order.isPaid || (pending === 0 && paidAmount(order) > 0)) {
    return `Hola ${order.customerName}! Confirmamos el pago de tu pedido ${order.orderNumber} por *${money(getOrderTotals(order).total)}*. ¡Gracias!`;
  }
  const account = order.paymentAccount ? `\nPuedes pagar por *${order.paymentMethod}*: ${order.paymentAccount}` : '';
  const partial = paidAmount(order) > 0 ? ` (ya recibimos ${money(paidAmount(order))})` : '';
  return (
    `Hola ${order.customerName}! El total pendiente de tu pedido ${order.orderNumber} es *${money(pending)}*${partial}.` +
    account +
    (order.paymentAccount ? '\nCuando pagues, envíanos el comprobante por aquí. ¡Gracias!' : '\n¡Gracias!')
  );
}

/**
 * Cuánto entró por cada método. Con pagos registrados (cuenta dividida) se usan esos y lo que
 * falte se atribuye al método elegido por el cliente; sin pagos, todo va a ese método.
 */
export function paymentsByMethod(order: Pick<Order, 'paymentMethod' | 'total' | 'payments'>): { method: string; amount: number }[] {
  const payments: Pick<OrderPayment, 'method' | 'amount'>[] = [...(order.payments ?? [])];
  const pending = order.total - paidAmount(order);
  if (pending > 0) payments.push({ method: order.paymentMethod, amount: pending });
  const map = new Map<string, number>();
  for (const p of payments) map.set(p.method, (map.get(p.method) ?? 0) + p.amount);
  return Array.from(map, ([method, amount]) => ({ method, amount }));
}
