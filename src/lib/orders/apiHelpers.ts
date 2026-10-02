// SOLO servidor: respuestas de las rutas públicas del checkout.
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { CheckoutError } from './checkout.schema';

/** Convierte errores de validación y de negocio en JSON `{ error }` con su código. */
export function checkoutErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    // Los mensajes propios del esquema ("Escribe tu nombre") se muestran tal cual; los genéricos de zod no
    const custom = issue && issue.code === 'custom' ? issue.message : undefined;
    const fromSchema = issue && !['Required', 'Invalid input'].includes(issue.message) && !issue.message.startsWith('Expected') ? issue.message : undefined;
    const message = custom ?? fromSchema ?? 'Faltan datos del pedido. Revisa el formulario e intenta de nuevo.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (error instanceof CheckoutError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: 'No pudimos procesar tu pedido. Intenta de nuevo.' }, { status: 500 });
}

/** Lee el body como JSON (body inválido = 400). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new CheckoutError('Solicitud inválida.', 400);
  }
}
