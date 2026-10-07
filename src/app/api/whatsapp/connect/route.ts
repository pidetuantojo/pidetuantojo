import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

import { getWhatsAppSession } from '@/lib/whatsapp/session';

const SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
const SERVICE_KEY = process.env.WHATSAPP_API_KEY;

function serviceHeaders() {
  return { 'Content-Type': 'application/json', ...(SERVICE_KEY ? { 'x-api-key': SERVICE_KEY } : {}) };
}

function restaurantId(req: NextRequest) {
  return req.nextUrl.searchParams.get('restaurantId') ?? '';
}

// GET /api/whatsapp/connect?restaurantId= — estado + QR
export async function GET(req: NextRequest) {
  const rid = restaurantId(req);

  if (SERVICE_URL) {
    const res = await fetch(`${SERVICE_URL}/status?restaurantId=${rid}`, { headers: serviceHeaders() });
    const data = await res.json();
    return NextResponse.json(data);
  }

  // Dev local — singleton
  const session = getWhatsAppSession();
  const { status, qr, connectedNumber, lastError } = session.getState();
  let qrDataUrl: string | null = null;
  if (qr) qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
  return NextResponse.json({ status, qr: qrDataUrl, connectedNumber, lastError });
}

// POST /api/whatsapp/connect — iniciar conexión
export async function POST(req: NextRequest) {
  const rid = restaurantId(req);

  if (SERVICE_URL) {
    await fetch(`${SERVICE_URL}/connect?restaurantId=${rid}`, { method: 'POST', headers: serviceHeaders() });
    return NextResponse.json({ ok: true });
  }

  const session = getWhatsAppSession();
  session.init().catch(() => {});
  return NextResponse.json({ ok: true });
}

// DELETE /api/whatsapp/connect — desconectar
export async function DELETE(req: NextRequest) {
  const rid = restaurantId(req);

  if (SERVICE_URL) {
    await fetch(`${SERVICE_URL}/connect?restaurantId=${rid}`, { method: 'DELETE', headers: serviceHeaders() });
    return NextResponse.json({ ok: true });
  }

  const session = getWhatsAppSession();
  await session.disconnect();
  return NextResponse.json({ ok: true });
}
