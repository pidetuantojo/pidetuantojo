import type { Order, OrderPayment, PaymentMethodConfig } from '@/types';

export interface OrderPaymentsListProps {
  order: Order;
  restaurantId: string;
  paymentMethods?: PaymentMethodConfig[];
  /** Caja activa: los pagos se reversan/devuelven por la API de caja. */
  cashEnabled: boolean;
  /** `orders.mark_paid`: puede anular pagos del modo anterior. */
  canMarkPaid: boolean;
  /** `cash.reverse`: puede reversar pagos y registrar devoluciones. */
  canReverse: boolean;
  /** Anulación del modo anterior (sin caja). */
  onRemoveLegacy: (paymentId: string) => void;
}

export interface ReversePaymentDialogProps {
  order: Order;
  payment: OrderPayment;
  onClose: () => void;
}

export interface RefundDialogProps {
  order: Order;
  paymentMethods?: PaymentMethodConfig[];
  onClose: () => void;
}
