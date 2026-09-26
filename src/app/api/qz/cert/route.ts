import { createPrivateKey, X509Certificate } from 'node:crypto';
import { NextResponse } from 'next/server';

import { describePublicCertValue, getQzCertificate, getQzPrivateKey } from '@/lib/printer/qzServerKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPECTED = {
  base64: 'QZ_PUBLIC_CERT_BASE64: una línea que empieza con "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t"',
  pem: 'o QZ_PUBLIC_CERT: el PEM completo, de "-----BEGIN CERTIFICATE-----" a "-----END CERTIFICATE-----"',
};

/**
 * Certificado público de QZ Tray.
 * Antes de servirlo valida que se pueda leer y que la clave privada le corresponda: si no, QZ Tray
 * trataría las solicitudes como anónimas y no dejaría recordar "Allow". Mejor un error claro.
 * Guía: docs/impresion-qz-tray.md
 */
export async function GET() {
  const cert = getQzCertificate();
  if (!cert.variable) {
    return NextResponse.json({ error: 'Falta el certificado: configura QZ_PUBLIC_CERT_BASE64', esperado: EXPECTED }, { status: 500 });
  }

  let x509: X509Certificate | null = null;
  try {
    if (cert.pem) x509 = new X509Certificate(cert.pem);
  } catch {
    x509 = null;
  }
  if (!x509) {
    // El certificado es público: mostrar qué llegó ayuda a encontrar el error de copiado
    return NextResponse.json(
      { error: `${cert.variable} no es un certificado válido`, recibido: describePublicCertValue(), esperado: EXPECTED },
      { status: 500 }
    );
  }

  const key = getQzPrivateKey();
  if (!key.variable) {
    return NextResponse.json({ error: 'Falta la clave privada: configura QZ_PRIVATE_KEY_BASE64' }, { status: 500 });
  }
  try {
    if (!key.pem || !x509.checkPrivateKey(createPrivateKey(key.pem))) {
      return NextResponse.json({ error: `${key.variable} no corresponde al certificado` }, { status: 500 });
    }
  } catch {
    // Nunca se muestra nada del valor de la clave privada
    return NextResponse.json({ error: `${key.variable} no es una clave válida (revisa que esté completa)` }, { status: 500 });
  }

  return new NextResponse(`${cert.pem}\n`, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
