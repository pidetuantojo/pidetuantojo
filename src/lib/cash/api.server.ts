// SOLO servidor: respuesta de errores de las rutas /api/cash.
import { NextResponse } from 'next/server';

import { ledgerErrorResponse } from '@/lib/ledger/api.server';

import { CashError } from './cash.errors';

export { parseBody } from '@/lib/ledger/api.server';

/** Errores de caja → JSON `{ error, code }`; el resto (zod, ledger, auth) lo resuelve el libro. */
export function cashErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof CashError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return ledgerErrorResponse(error, context);
}

/** Quita la auditoría (IP, user agent) de lo que se devuelve al cliente. */
export function omitAudit<T extends { audit?: unknown }>(doc: T): Omit<T, 'audit'> {
  const { audit: _audit, ...rest } = doc;
  return rest;
}
