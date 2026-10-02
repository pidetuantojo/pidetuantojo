import { NextResponse } from 'next/server';

import { checkoutErrorResponse, readJson } from '@/lib/orders/apiHelpers';
import { checkoutSchema } from '@/lib/orders/checkout.schema';
import { createPublicOrder } from '@/lib/orders/createOrder.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Checkout del menú público (sin sesión). El navegador manda qué pidió; los precios, promociones
// y totales se calculan acá. Las reglas de Firestore ya no permiten crear pedidos desde el menú.
export async function POST(request: Request) {
  try {
    const input = checkoutSchema.parse(await readJson(request));
    const order = await createPublicOrder(input);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return checkoutErrorResponse(error, 'POST /api/orders');
  }
}
