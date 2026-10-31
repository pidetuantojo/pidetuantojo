import { NextResponse } from 'next/server';

import { AuthError, errorResponse, requirePermission } from '@/lib/auth/serverAuth';
import { checkoutErrorResponse, readJson } from '@/lib/orders/apiHelpers';
import { panelOrderSchema } from '@/lib/orders/checkout.schema';
import { createPanelOrder } from '@/lib/orders/createOrder.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pedido manual del panel. Igual que la carta: el navegador manda QUÉ se pidió y el servidor calcula
// precios, promociones, cupón y fidelidad (y suma los usos de cada promoción).
// Con `dryRun: true` solo devuelve el cálculo (vista previa del modal) sin guardar.
export async function POST(request: Request) {
  try {
    const input = panelOrderSchema.parse(await readJson(request));
    const caller = await requirePermission(request, 'orders.create', input.restaurantId);
    const order = await createPanelOrder(input, { uid: caller.uid, name: caller.name });
    return NextResponse.json(order, { status: input.dryRun ? 200 : 201 });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error, 'Sin permiso');
    return checkoutErrorResponse(error, 'POST /api/orders/manual');
  }
}
