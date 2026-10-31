import { NextResponse } from 'next/server';

import { checkoutErrorResponse, readJson } from '@/lib/orders/apiHelpers';
import { checkoutSchema, type CheckoutData, type CheckoutResponse } from '@/lib/orders/checkout.schema';
import { createPublicOrder } from '@/lib/orders/createOrder.server';
import { notifyNewOrder, withTimeout } from '@/lib/push/push.server';
import { isAutoNotifyOn, sendWhatsApp, waPhone } from '@/lib/whatsapp/send.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Topes para los avisos: corren en paralelo y el cliente nunca espera más que el mayor
const PUSH_TIMEOUT_MS = 4000;
const WA_TIMEOUT_MS = 5000;

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

  // Si un aviso falla o tarda, el pedido ya está creado: se responde igual
  const { customerMessage, ...response } = order;
  await Promise.all([notifyRestaurant(input, order), notifyCustomer(input, order.id, customerMessage)]);

  return NextResponse.json(response, { status: 201 });
}

/** Push a los dispositivos del restaurante (app cerrada o pantalla bloqueada). */
async function notifyRestaurant(input: CheckoutData, order: CheckoutResponse) {
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
}

/**
 * WhatsApp de confirmación al cliente. El texto ya viene armado con la plantilla del estado
 * "Recibido" (sin él, ese estado no avisa). Se envía desde acá: el navegador nunca manda
 * texto ni teléfono. Los pedidos de mesa no reciben avisos.
 */
async function notifyCustomer(input: CheckoutData, orderId: string, message: string | undefined) {
  const phone = waPhone(input.customerPhone);
  if (!message || !phone || input.deliveryType === 'mesa') return;
  try {
    if (!(await isAutoNotifyOn(input.restaurantId))) return;
    const result = await withTimeout(sendWhatsApp(input.restaurantId, phone, message), WA_TIMEOUT_MS);
    if (result === 'timeout') console.warn('[POST /api/orders] El WhatsApp al cliente tardó demasiado:', orderId);
    else if (!result.ok) console.warn('[POST /api/orders] No se pudo enviar el WhatsApp al cliente:', result.error);
  } catch (error) {
    console.error('[POST /api/orders] Error enviando el WhatsApp al cliente:', error);
  }
}
