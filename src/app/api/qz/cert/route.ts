import { createPrivateKey, X509Certificate } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Certificado público de QZ Tray (no es secreto: es el mismo que se instala en la PC del restaurante).
 * Antes de servirlo valida la configuración: si el PEM está dañado (ej. mal pegado en Vercel)
 * o la clave privada no corresponde, QZ Tray trataría las solicitudes como anónimas y no dejaría
 * recordar "Allow". Mejor fallar con un error claro que imprimir con diálogos.
 */
export async function GET() {
  const certPem = process.env.QZ_PUBLIC_CERT?.replace(/\\n/g, '\n').trim();
  if (!certPem) {
    return NextResponse.json({ error: 'QZ_PUBLIC_CERT no está configurada' }, { status: 500 });
  }

  let cert: X509Certificate;
  try {
    cert = new X509Certificate(certPem);
  } catch {
    return NextResponse.json({ error: 'QZ_PUBLIC_CERT no es un certificado válido (revisa que esté completo y sin cambios)' }, { status: 500 });
  }

  const keyPem = process.env.QZ_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (keyPem) {
    try {
      if (!cert.checkPrivateKey(createPrivateKey(keyPem))) {
        return NextResponse.json({ error: 'QZ_PRIVATE_KEY no corresponde a QZ_PUBLIC_CERT' }, { status: 500 });
      }
    } catch {
      return NextResponse.json({ error: 'QZ_PRIVATE_KEY no es una clave válida (revisa que esté completa y sin cambios)' }, { status: 500 });
    }
  }

  return new NextResponse(`${certPem}\n`, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
