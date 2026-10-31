import type {
  ActivationStatus,
  CashSettings,
  OrderPaymentResult,
  PayOrderInput,
  RefundInput,
  RefundResult,
  ReversePaymentInput,
  UpdateSettingsInput,
} from '../types/cash.types';

import { request } from './cash.http';

/** Cobros de pedidos, ajustes y activación del módulo. */
export const cashOrdersApi = {
  payOrder: (input: PayOrderInput, idempotencyKey: string) =>
    request<OrderPaymentResult>('/api/cash/order-payments', {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  reversePayment: ({ orderId, paymentId, reason }: ReversePaymentInput, idempotencyKey: string) =>
    request<Omit<OrderPaymentResult, 'change'>>(
      `/api/cash/order-payments/${encodeURIComponent(orderId)}/payments/${encodeURIComponent(paymentId)}/reverse`,
      { method: 'POST', body: { reason }, idempotencyKey }
    ),

  refund: (input: RefundInput, idempotencyKey: string) =>
    request<RefundResult>('/api/cash/refunds', { method: 'POST', body: input, idempotencyKey }),

  getSettings: async () =>
    (await request<{ settings: CashSettings }>('/api/cash/settings')).settings,

  updateSettings: async (input: UpdateSettingsInput, idempotencyKey: string) =>
    (
      await request<{ settings: CashSettings }>('/api/cash/settings', {
        method: 'PUT',
        body: input,
        idempotencyKey,
      })
    ).settings,

  getActivation: () => request<ActivationStatus>('/api/cash/activation'),

  setActivation: (enabled: boolean, idempotencyKey: string) =>
    request<ActivationStatus>('/api/cash/activation', {
      method: 'POST',
      body: { enabled },
      idempotencyKey,
    }),
};
