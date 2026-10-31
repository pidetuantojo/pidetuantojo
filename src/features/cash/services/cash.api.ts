import { authFetch } from '@/lib/auth/authFetch';

import type {
  ActivationStatus,
  CashApiErrorBody,
  CashSettings,
  OrderPaymentResult,
  PayOrderInput,
  RefundInput,
  RefundResult,
  ReversePaymentInput,
} from '../types/cash.types';

/** Error de la API de caja con el código de dominio (`SHIFT_REQUIRED`, `OVERPAYMENT`...). */
export class CashApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Solo en `ACTIVATION_PREREQUISITES`: lo que falta para activar la caja. */
    readonly missing: string[] = []
  ) {
    super(message);
    this.name = 'CashApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  /** Obligatorio en todo POST/PUT: una llave por intención del usuario. */
  idempotencyKey?: string;
}

async function readErrorBody(response: Response): Promise<CashApiErrorBody> {
  try {
    return (await response.json()) as CashApiErrorBody;
  } catch {
    return {};
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, idempotencyKey } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    if (!idempotencyKey) throw new Error('Falta la llave de idempotencia');
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const response = await authFetch(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const payload = await readErrorBody(response);
    throw new CashApiError(
      response.status,
      payload.code ?? 'UNKNOWN',
      payload.error ?? 'No se pudo completar la operación',
      payload.missing
    );
  }
  return (await response.json()) as T;
}

export const cashApi = {
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

  getActivation: () => request<ActivationStatus>('/api/cash/activation'),

  setActivation: (enabled: boolean, idempotencyKey: string) =>
    request<ActivationStatus>('/api/cash/activation', {
      method: 'POST',
      body: { enabled },
      idempotencyKey,
    }),
};
