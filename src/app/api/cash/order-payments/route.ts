import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { payOrderSchema } from '@/lib/cash/cash.schemas';
import { payOrder } from '@/lib/cash/order-payments.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cobra un pedido (una o varias formas de pago): un movimiento de caja por cada pago
export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.operate');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, payOrderSchema);
    const result = await payOrder(restaurantId, input, {
      audit: buildAuditContext(request, caller, { orderId: input.orderId }),
      idempotencyKey,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/order-payments POST');
  }
}
