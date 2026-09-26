import { createPrivateKey, X509Certificate } from 'node:crypto';
import { NextResponse } from 'next/server';

import { QZ_CERTIFICATE } from '@/lib/printer/qzCertificate';
import { getQzPrivateKey } from '@/lib/printer/qzServerKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Certificado público de QZ Tray (vive en el código: no es secreto).
 * Antes de servirlo valida que la clave privada del servidor le corresponda: si no, QZ Tray
 * trataría las solicitudes como anónimas y no dejaría recordar "Allow". Mejor un error claro.
 */
export async function GET() {
  const keyPem = getQzPrivateKey();
  if (!keyPem) {
    return NextResponse.json({ error: 'QZ_PRIVATE_KEY_BASE64 no está configurada' }, { status: 500 });
  }

  try {
    if (!new X509Certificate(QZ_CERTIFICATE).checkPrivateKey(createPrivateKey(keyPem))) {
      return NextResponse.json({ error: 'La clave privada no corresponde al certificado de QZ Tray' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'QZ_PRIVATE_KEY_BASE64 no es una clave válida (revisa que esté completa)' }, { status: 500 });
  }

  return new NextResponse(`${QZ_CERTIFICATE}\n`, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
