import { createPrivateKey, X509Certificate } from 'node:crypto';
import { NextResponse } from 'next/server';

import { getQzCertificate, getQzPrivateKey } from '@/lib/printer/qzServerKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Certificado público de QZ Tray.
 * Antes de servirlo valida que se pueda leer y que la clave privada le corresponda: si no, QZ Tray
 * trataría las solicitudes como anónimas y no dejaría recordar "Allow". Mejor un error claro.
 * Guía: docs/impresion-qz-tray.md
 */
export async function GET() {
  const certPem = getQzCertificate();
  if (!certPem) {
    return NextResponse.json({ error: 'QZ_PUBLIC_CERT_BASE64 no está configurada' }, { status: 500 });
  }
  const keyPem = getQzPrivateKey();
  if (!keyPem) {
    return NextResponse.json({ error: 'QZ_PRIVATE_KEY_BASE64 no está configurada' }, { status: 500 });
  }

  let cert: X509Certificate;
  try {
    cert = new X509Certificate(certPem);
  } catch {
    return NextResponse.json({ error: 'QZ_PUBLIC_CERT_BASE64 no es un certificado válido (revisa que esté completo)' }, { status: 500 });
  }

  try {
    if (!cert.checkPrivateKey(createPrivateKey(keyPem))) {
      return NextResponse.json({ error: 'QZ_PRIVATE_KEY_BASE64 no corresponde a QZ_PUBLIC_CERT_BASE64' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'QZ_PRIVATE_KEY_BASE64 no es una clave válida (revisa que esté completa)' }, { status: 500 });
  }

  return new NextResponse(`${certPem}\n`, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
