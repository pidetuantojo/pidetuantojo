import { NextRequest, NextResponse } from 'next/server';

import { getWhatsAppSession } from '@/lib/whatsapp/session';

const SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
const SERVICE_KEY = process.env.WHATSAPP_API_KEY;

function serviceHeaders() {
  return { 'Content-Type': 'application/json', ...(SERVICE_KEY ? { 'x-api-key': SERVICE_KEY } : {}) };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { restaurantId, phone, message } = body as { restaurantId?: string; phone?: string; message?: string };

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone y message son requeridos' }, { status: 400 });
  }

  if (SERVICE_URL) {
    const res = await fetch(`${SERVICE_URL}/notify`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify({ restaurantId, phone, message }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  // Dev local — singleton
  const session = getWhatsAppSession();
  try {
    await session.sendMessage(phone, message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al enviar' },
      { status: 500 },
    );
  }
}
