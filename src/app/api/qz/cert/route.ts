import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Certificado público de QZ Tray (no es secreto: es el mismo que se instala en la PC del restaurante). */
export async function GET() {
  const cert = process.env.QZ_PUBLIC_CERT?.replace(/\\n/g, '\n');
  if (!cert) {
    return NextResponse.json({ error: 'QZ_PUBLIC_CERT no está configurada' }, { status: 500 });
  }
  return new NextResponse(cert, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
