import { NextResponse } from 'next/server';
import { z } from 'zod';

import { checkoutErrorResponse, readJson } from '@/lib/orders/apiHelpers';
import { CheckoutError } from '@/lib/orders/checkout.schema';
import { loadActivePromotions, toPublicPromotion } from '@/lib/promotions/promotions.server';
import { loadPublicRestaurant } from '@/lib/restaurants/restaurant.server';
import { normalizeCouponCode } from '@/features/promotions/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  restaurantId: z.string().min(1).max(128),
  code: z.string().trim().min(1, 'Escribe el código del cupón').max(40),
});

// Busca un cupón para la vista previa del carrito. Las promociones con cupón no se envían al menú
// (se revelaría el código); el precio final igual lo recalcula /api/orders.
export async function POST(request: Request) {
  try {
    const { restaurantId, code } = schema.parse(await readJson(request));
    const restaurant = await loadPublicRestaurant(restaurantId);
    if (!restaurant) throw new CheckoutError('Este restaurante no está recibiendo pedidos.', 404);

    const normalized = normalizeCouponCode(code);
    const promotion = (await loadActivePromotions(restaurant))
      .find((p) => p.couponCode && normalizeCouponCode(p.couponCode) === normalized);
    if (!promotion) throw new CheckoutError('Este cupón no existe o ya no está disponible.', 404);

    return NextResponse.json({ promotion: toPublicPromotion(promotion) });
  } catch (error) {
    return checkoutErrorResponse(error, 'POST /api/promotions/coupon');
  }
}
