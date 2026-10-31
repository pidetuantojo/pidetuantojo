import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

import { errorResponse, requirePermission } from '@/lib/auth/serverAuth';
import { getWhatsAppSession } from '@/lib/whatsapp/session';
import { isAutoNotifyOn } from '@/lib/whatsapp/send.server';

const SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
const SERVICE_KEY = process.env.WHATSAPP_API_KEY;

// Conectar/desconectar y ver el QR: mismo permiso que editar la configuración del restaurante
const MANAGE_PERMISSION = 'settings.update_info';

function serviceHeaders() {
  return { 'Content-Type': 'application/json', ...(SERVICE_KEY ? { 'x-api-key': SERVICE_KEY } : {}) };
}

function restaurantId(req: NextRequest) {
  return req.nextUrl.searchParams.get('restaurantId') ?? '';
}

async function canManage(req: NextRequest, rid: string): Promise<boolean> {
  try {
    await requirePermission(req, MANAGE_PERMISSION, rid);
    return true;
  } catch {
    return false;
  }
}

// GET /api/whatsapp/connect?restaurantId= — estado + autoNotify (público: lo usa la carta).
// El QR, el número y el error solo con sesión y permiso: con el QR cualquiera podría vincular su teléfono.
export async function GET(req: NextRequest) {
  const rid = restaurantId(req);
  if (!rid) return NextResponse.json({ error: 'restaurantId requerido' }, { status: 400 });
  const [autoNotify, full] = await Promise.all([isAutoNotifyOn(rid), canManage(req, rid)]);

  let state: { status: string; qr?: string | null; connectedNumber?: string | null; lastError?: string | null };
  if (SERVICE_URL) {
    const res = await fetch(`${SERVICE_URL}/status?restaurantId=${rid}`, { headers: serviceHeaders() });
    state = await res.json();
  } else {
    // Dev local — singleton
    const { status, qr, connectedNumber, lastError } = getWhatsAppSession().getState();
    state = { status, qr: qr ? await QRCode.toDataURL(qr, { width: 256, margin: 2 }) : null, connectedNumber, lastError };
  }

  if (!full) return NextResponse.json({ status: state.status, autoNotify });
  return NextResponse.json({ ...state, autoNotify });
}

// POST /api/whatsapp/connect — iniciar conexión
export async function POST(req: NextRequest) {
  const rid = restaurantId(req);
  try {
    await requirePermission(req, MANAGE_PERMISSION, rid);
  } catch (error) {
    return errorResponse(error, 'Sin permiso');
  }

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
  try {
    await requirePermission(req, MANAGE_PERMISSION, rid);
  } catch (error) {
    return errorResponse(error, 'Sin permiso');
  }

  if (SERVICE_URL) {
    await fetch(`${SERVICE_URL}/connect?restaurantId=${rid}`, { method: 'DELETE', headers: serviceHeaders() });
    return NextResponse.json({ ok: true });
  }

  const session = getWhatsAppSession();
  await session.disconnect();
  return NextResponse.json({ ok: true });
}
