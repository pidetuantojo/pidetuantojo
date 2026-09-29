import { NextRequest, NextResponse } from 'next/server';

import { AuthError, errorResponse, requireRole } from '@/lib/auth/serverAuth';
import { syncPlanPermissions, syncRestaurantPermissions } from '@/lib/permissions/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recalcula permisos efectivos (solo super admin). Se llama después de:
 * - guardar un plan            → { planId }
 * - crear un restaurante o cambiarle el plan → { restaurantId }
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole(request, ['super_admin']);
    const { planId, restaurantId } = (await request.json()) as { planId?: string; restaurantId?: string };

    if (planId) {
      const result = await syncPlanPermissions(planId);
      return NextResponse.json({ ok: true, ...result });
    }
    if (restaurantId) {
      const users = await syncRestaurantPermissions(restaurantId);
      return NextResponse.json({ ok: true, restaurants: 1, users });
    }
    throw new AuthError('Indica planId o restaurantId', 400);
  } catch (error) {
    return errorResponse(error, 'Error al sincronizar permisos');
  }
}
