import { NextResponse } from 'next/server';
import { z } from 'zod';

import { normalizePhone } from '@/lib/customers/phone';
import { checkoutErrorResponse, readJson } from '@/lib/orders/apiHelpers';
import { CheckoutError, type CustomerStatusResponse } from '@/lib/orders/checkout.schema';
import { getCustomerProfile, getLoyaltyStatus } from '@/lib/promotions/promotions.server';
import { loadPublicRestaurant } from '@/lib/restaurants/restaurant.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  restaurantId: z.string().min(1).max(128),
  phone: z.string().trim().min(7).max(40),
});

// Vista previa del carrito al escribir el celular: si es cliente nuevo (promos de primer pedido)
// y cuántos sellos de fidelidad lleva. Solo devuelve contadores: nunca nombres ni direcciones.
export async function POST(request: Request) {
  try {
    const { restaurantId, phone } = schema.parse(await readJson(request));
    const phoneKey = normalizePhone(phone);
    if (!phoneKey) throw new CheckoutError('Escribe un celular válido.', 400);

    const restaurant = await loadPublicRestaurant(restaurantId);
    if (!restaurant) throw new CheckoutError('Este restaurante no está recibiendo pedidos.', 404);

    const profile = await getCustomerProfile(restaurant.id, phoneKey);
    const loyalty = await getLoyaltyStatus(restaurant, phoneKey, profile.customer);

    const body: CustomerStatusResponse = {
      isNew: profile.isNew,
      promoUses: profile.customer?.promoUses ?? {},
      loyalty: loyalty ? { stamps: loyalty.stamps, required: loyalty.required, rewardAvailable: loyalty.rewardAvailable } : null,
    };
    return NextResponse.json(body);
  } catch (error) {
    return checkoutErrorResponse(error, 'POST /api/customers/status');
  }
}
