import type { ActivationStatus } from '@/lib/cash/activation.server';
import type { CashSettings } from '@/lib/cash/cash.types';
import type { RefundResult } from '@/lib/cash/refunds.server';
import type { OrderPaymentResult } from '@/lib/cash/order-payments.server';
import type { Money } from '@/lib/shared/money';

// Solo tipos del servidor (se borran al compilar): el cliente nunca importa código de Admin SDK.
export type { ActivationStatus, CashSettings, OrderPaymentResult, RefundResult };

export interface PayOrderItemInput {
  paymentMethodId: string;
  amount: Money;
  /** Solo efectivo: lo que entregó el cliente. */
  received?: Money;
  label?: string;
  externalRef?: string;
}

export interface PayOrderInput {
  orderId: string;
  payments: PayOrderItemInput[];
}

export interface ReversePaymentInput {
  orderId: string;
  paymentId: string;
  reason: string;
}

export interface RefundInput {
  orderId: string;
  paymentMethodId: string;
  amount: Money;
  reason: string;
}

/** Cuerpo de error de /api/cash/*: `{ error, code, ...extra }`. */
export interface CashApiErrorBody {
  error?: string;
  code?: string;
  missing?: string[];
}
