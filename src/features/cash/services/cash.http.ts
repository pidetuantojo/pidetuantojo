import { authFetch } from '@/lib/auth/authFetch';

import type { CashApiErrorBody } from '../types/cash.types';

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

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  body?: unknown;
  /** Obligatorio en todo POST/PUT/PATCH: una llave por intención del usuario. */
  idempotencyKey?: string;
}

async function readErrorBody(response: Response): Promise<CashApiErrorBody> {
  try {
    return (await response.json()) as CashApiErrorBody;
  } catch {
    return {};
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
