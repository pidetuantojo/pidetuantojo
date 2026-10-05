import { NextResponse } from 'next/server';

import { checkoutErrorResponse, readJson } from '@/lib/orders/apiHelpers';
import { checkoutSchema } from '@/lib/orders/checkout.schema';
import { createPublicOrder } from '@/lib/orders/createOrder.server';
import { notifyNewOrder, withTimeout } from '@/lib/push/push.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tope para el aviso push: el cliente nunca espera más que esto por él
const PUSH_TIMEOUT_MS = 4000;

// Checkout del menú público (sin sesión). El navegador manda qué pidió; los precios, promociones
// y totales se calculan acá. Las reglas de Firestore ya no permiten crear pedidos desde el menú.
export async function POST(request: Request) {
  let order;
  let input;
  try {
    input = checkoutSchema.parse(await readJson(request));
    order = await createPublicOrder(input);
  } catch (error) {
    return checkoutErrorResponse(error, 'POST /api/orders');
  }

  // Aviso a los dispositivos del restaurante (app cerrada o pantalla bloqueada).
  // Si falla o tarda, el pedido ya está creado: se responde igual.
  try {
    const result = await withTimeout(
      notifyNewOrder(input.restaurantId, {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: input.customerName,
        total: order.total,
        deliveryType: input.deliveryType,
        tableName: order.tableName,
        isScheduled: !!input.scheduledFor,
      }),
      PUSH_TIMEOUT_MS
    );
    if (result === 'timeout') console.warn('[POST /api/orders] El aviso push tardó demasiado:', order.id);
  } catch (error) {
    console.error('[POST /api/orders] No se pudo enviar el aviso push:', error);
  }

  return NextResponse.json(order, { status: 201 });
}
