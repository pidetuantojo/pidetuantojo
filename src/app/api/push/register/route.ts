import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AuthError, errorResponse, requirePermission } from '@/lib/auth/serverAuth';
import { registerPushToken, unregisterPushToken } from '@/lib/push/push.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['ios', 'android', 'desktop']).optional(),
});

async function readBody(request: Request) {
  try {
    return schema.parse(await request.json());
  } catch {
    throw new AuthError('Token inválido', 400);
  }
}

// Activa los avisos de pedidos en este dispositivo (quien ve pedidos de un restaurante)
export async function POST(request: Request) {
  try {
    const caller = await requirePermission(request, 'orders.view');
    if (!caller.restaurantId) throw new AuthError('Tu usuario no tiene un restaurante asignado', 403);
    const { token, platform } = await readBody(request);
    await registerPushToken({ uid: caller.uid, restaurantId: caller.restaurantId, token, platform });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'No se pudieron activar los avisos');
  }
}

// Desactiva los avisos en este dispositivo
export async function DELETE(request: Request) {
  try {
    const caller = await requirePermission(request, 'orders.view');
    const { token } = await readBody(request);
    await unregisterPushToken(caller.uid, token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'No se pudieron desactivar los avisos');
  }
}
