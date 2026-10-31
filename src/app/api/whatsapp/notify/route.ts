import { NextResponse } from 'next/server';
import { z } from 'zod';

import { errorResponse, requirePermission } from '@/lib/auth/serverAuth';
import { notifyOrderEvent, OrderNotFoundError } from '@/lib/whatsapp/notifyOrder.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// El navegador solo dice QUÉ pedido y QUÉ evento. Nunca manda teléfono ni texto:
// antes se aceptaban, y cualquiera podía escribir lo que quisiera desde el número del restaurante.
const schema = z.object({
  restaurantId: z.string().min(1),
  orderId: z.string().min(1),
  event: z.enum(['status', 'paid']),
});

// POST /api/whatsapp/notify — requiere sesión y permiso sobre el pedido
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  const { restaurantId, orderId, event } = parsed.data;

  try {
    await requirePermission(request, event === 'paid' ? 'orders.mark_paid' : 'orders.change_status', restaurantId);
    const result = await notifyOrderEvent(restaurantId, orderId, event);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OrderNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return errorResponse(error, 'No se pudo enviar el aviso');
  }
}
