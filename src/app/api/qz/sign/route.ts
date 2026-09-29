import { createSign } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import type { Permission } from '@/constants/permissions';
import { AuthError, errorResponse, getCaller } from '@/lib/auth/serverAuth';
import { canAny } from '@/lib/permissions/permissions';
import { getQzPrivateKey } from '@/lib/printer/qzServerKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Imprimir comandas, correr la estación o probar la impresora desde Configuración
const PRINT_PERMISSIONS: readonly Permission[] = ['orders.print', 'print_station.run', 'printers.view'];
// Los mensajes que firma QZ Tray son cortos (un hash + timestamp); se rechaza cualquier cosa grande
const MAX_REQUEST_LENGTH = 10_000;


/**
 * Firma (SHA512) las solicitudes de QZ Tray con la clave privada del servidor.
 * Solo usuarios activos con algún permiso de impresión: como la PC del restaurante confía en este
 * certificado sin preguntar, un endpoint abierto dejaría usar QZ Tray a cualquier sitio.
 */
export async function POST(request: NextRequest) {
  const { pem: key, variable } = getQzPrivateKey();
  if (!key) {
    const reason = variable ? `${variable} no es una clave válida` : 'QZ_PRIVATE_KEY_BASE64 no está configurada';
    return NextResponse.json({ error: reason }, { status: 500 });
  }

  try {
    const caller = await getCaller(request);
    if (caller.role !== 'super_admin' && !canAny(caller.permissions, PRINT_PERMISSIONS)) {
      throw new AuthError('Sin permiso para imprimir', 403);
    }
  } catch (error) {
    return errorResponse(error, 'Sesión inválida', 401);
  }

  let toSign: unknown;
  try {
    toSign = ((await request.json()) as { request?: unknown }).request;
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }
  if (typeof toSign !== 'string' || !toSign || toSign.length > MAX_REQUEST_LENGTH) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }

  try {
    const signature = createSign('SHA512').update(toSign).sign(key, 'base64');
    return new NextResponse(signature, {
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo firmar' }, { status: 500 });
  }
}
