import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

import { adminDb } from '@/lib/firebase/admin';
import { getWhatsAppSession } from '@/lib/whatsapp/session';

const SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
const SERVICE_KEY = process.env.WHATSAPP_API_KEY;

function serviceHeaders() {
  return { 'Content-Type': 'application/json', ...(SERVICE_KEY ? { 'x-api-key': SERVICE_KEY } : {}) };
}

function restaurantId(req: NextRequest) {
  return req.nextUrl.searchParams.get('restaurantId') ?? '';
}

// El menú público no puede leer settings/waConfig (reglas: solo miembros), así que
// el toggle "Mensajes automáticos" se expone acá, leído con Admin SDK.
async function getAutoNotify(rid: string): Promise<boolean> {
  if (!rid) return false;
  try {
    const snap = await adminDb.doc(`restaurants/${rid}/settings/waConfig`).get();
    return snap.data()?.autoNotify === true;
  } catch {
    return false;
  }
}

// GET /api/whatsapp/connect?restaurantId= — estado + QR + autoNotify
export async function GET(req: NextRequest) {
  const rid = restaurantId(req);
  const autoNotifyPromise = getAutoNotify(rid);

  if (SERVICE_URL) {
    const res = await fetch(`${SERVICE_URL}/status?restaurantId=${rid}`, { headers: serviceHeaders() });
    const data = await res.json();
    return NextResponse.json({ ...data, autoNotify: await autoNotifyPromise });
  }

  // Dev local — singleton
  const session = getWhatsAppSession();
  const { status, qr, connectedNumber, lastError } = session.getState();
  let qrDataUrl: string | null = null;
  if (qr) qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
  return NextResponse.json({ status, qr: qrDataUrl, connectedNumber, lastError, autoNotify: await autoNotifyPromise });
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
