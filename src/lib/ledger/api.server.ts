// SOLO servidor: helpers comunes de las rutas /api/ledger.
import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';

import { AuthError, errorResponse } from '@/lib/auth/serverAuth';

import { LedgerError } from './ledger.errors';

/** Lee y valida el body JSON; cualquier problema es 400. */
export async function parseBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AuthError('Solicitud inválida', 400);
  }
  return schema.parse(raw);
}

/** Errores de zod, de dominio y de autenticación → JSON `{ error }` con su código. */
export function ledgerErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  if (error instanceof LedgerError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof AuthError) return errorResponse(error, context);
  console.error(`[${context}]`, error instanceof Error ? error.message : 'error desconocido');
  return NextResponse.json({ error: 'No pudimos completar la operación' }, { status: 500 });
}
