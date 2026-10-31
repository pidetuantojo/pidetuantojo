// Reglas puras de pagos y devoluciones de pedidos a través de caja. Sin Firebase.
import {
  activePayments,
  isFullyPaid,
  paidAmount,
} from '@/features/orders/helpers/payments.helpers';
import { getOrderTotals } from '@/features/orders/helpers/totals.helpers';
import { getPaymentMethodsForDelivery } from '@/features/payment-methods/helpers/payment-methods.helpers';
import type { Order, OrderPayment, PaymentMethodConfig, Restaurant } from '@/types';

import { CashError } from './cash.errors';

export interface PaymentRequest {
  paymentMethodId: string;
  amount: number;
  received?: number;
}

export function orderTotal(order: Pick<Order, 'subtotal' | 'discount' | 'deliveryFee'>): number {
  return getOrderTotals(order).total;
}

/** Un pedido eliminado o cancelado no admite pagos. */
export function assertOrderPayable(
  order: Pick<Order, 'isDeleted'>,
  statusCode: string | undefined
): void {
  if (order.isDeleted) {
    throw new CashError('ORDER_NOT_PAYABLE', 'El pedido fue eliminado');
  }
  if (statusCode === 'cancelled') {
    throw new CashError('ORDER_NOT_PAYABLE', 'El pedido está cancelado');
  }
}

/** Los pagos vigentes más los nuevos no pueden superar el total del pedido. */
export function assertWithinTotal(
  order: Pick<Order, 'subtotal' | 'discount' | 'deliveryFee' | 'payments'>,
  newAmounts: readonly number[]
): void {
  const incoming = newAmounts.reduce((t, a) => t + a, 0);
  const remaining = orderTotal(order) - paidAmount(order);
  if (incoming > remaining) {
    throw new CashError(
      'OVERPAYMENT',
      `Los pagos superan lo pendiente del pedido (pendiente: ${remaining})`
    );
  }
}

/** Resuelve el medio pedido entre los admitidos por la forma de entrega del pedido. */
export function resolvePaymentMethod(
  restaurant: Pick<Restaurant, 'paymentMethods' | 'deliveryMethods'>,
  order: Pick<Order, 'deliveryType'>,
  paymentMethodId: string
): PaymentMethodConfig {
  const allowed = getPaymentMethodsForDelivery(
    restaurant.paymentMethods,
    restaurant.deliveryMethods,
    order.deliveryType ?? ''
  );
  const found = allowed.find((m) => m.id === paymentMethodId);
  if (!found) {
    throw new CashError(
      'METHOD_NOT_ALLOWED',
      'El medio de pago no está activo o no aplica a este pedido'
    );
  }
  return found;
}

/** `received` solo existe en efectivo y debe cubrir el monto. */
export function assertReceived(method: Pick<PaymentMethodConfig, 'type'>, p: PaymentRequest): void {
  if (p.received === undefined) return;
  if (method.type !== 'efectivo') {
    throw new CashError('INVALID_RECEIVED', 'Solo el efectivo admite monto recibido');
  }
  if (p.received < p.amount) {
    throw new CashError('INVALID_RECEIVED', 'Lo recibido no cubre el monto');
  }
}

/** Cambio informativo de un conjunto de pagos (solo los que traen `received`). */
export function computeChange(payments: readonly PaymentRequest[]): number | undefined {
  const withReceived = payments.filter((p) => p.received !== undefined);
  if (withReceived.length === 0) return undefined;
  return withReceived.reduce((t, p) => t + ((p.received as number) - p.amount), 0);
}

/** Lo máximo que se puede devolver: pagos vigentes − devoluciones previas. */
export function refundableAmount(order: Pick<Order, 'payments' | 'refunds'>): number {
  const refunded = (order.refunds ?? []).reduce((t, r) => t + r.amount, 0);
  return Math.max(0, paidAmount(order) - refunded);
}

export function assertRefundable(order: Pick<Order, 'payments' | 'refunds'>, amount: number): void {
  const limit = refundableAmount(order);
  if (amount > limit) {
    throw new CashError('REFUND_LIMIT', `La devolución supera lo disponible (máximo: ${limit})`);
  }
}

/** Marca un pago como reversado (nunca se borra) y devuelve el arreglo nuevo. */
export function markPaymentReversed(
  payments: readonly OrderPayment[],
  paymentId: string,
  reversal: Pick<
    OrderPayment,
    'reversedAt' | 'reversedBy' | 'reversalMovementId' | 'reversalReason'
  >
): OrderPayment[] {
  return payments.map((p) => (p.id === paymentId ? { ...p, ...reversal } : p));
}

export { activePayments, isFullyPaid };
