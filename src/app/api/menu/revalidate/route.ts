import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AuthError, errorResponse, getCaller } from '@/lib/auth/serverAuth';
import { revalidatePublicMenu } from '@/lib/menu/menuCache.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ restaurantId: z.string().min(1) });

// El panel avisa que cambió algo de la carta (productos, categorías, promociones, configuración…)
// para que la próxima visita lea lo nuevo. Solo alguien del restaurante o el super admin.
export async function POST(request: Request) {
  try {
    const caller = await getCaller(request);
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Falta el restaurante' }, { status: 400 });
    const { restaurantId } = parsed.data;
    if (caller.role !== 'super_admin' && caller.restaurantId !== restaurantId) {
      throw new AuthError('No perteneces a este restaurante', 403);
    }
    await revalidatePublicMenu(restaurantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'No se pudo actualizar la carta');
  }
}
