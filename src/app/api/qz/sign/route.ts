import { createSign } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getQzPrivateKey } from '@/lib/printer/qzServerKey';
import type { UserRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES: UserRole[] = ['super_admin', 'restaurant_admin', 'restaurant_view'];
// Los mensajes que firma QZ Tray son cortos (un hash + timestamp); se rechaza cualquier cosa grande
const MAX_REQUEST_LENGTH = 10_000;


/**
 * Firma (SHA512) las solicitudes de QZ Tray con la clave privada del servidor.
 * Solo usuarios autenticados y activos del dashboard: como la PC del restaurante confía en este
 * certificado sin preguntar, un endpoint abierto dejaría usar QZ Tray a cualquier sitio.
 */
export async function POST(request: NextRequest) {
  const key = getQzPrivateKey();
  if (!key) {
    return NextResponse.json({ error: 'QZ_PRIVATE_KEY_BASE64 no está configurada' }, { status: 500 });
  }

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const user = userSnap.data() as { role?: UserRole; isActive?: boolean } | undefined;
    if (!user?.isActive || !user.role || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Sin permiso para imprimir' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
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
