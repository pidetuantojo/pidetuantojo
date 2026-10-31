import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { refundSchema } from '@/lib/cash/cash.schemas';
import { refundOrder } from '@/lib/cash/refunds.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Devuelve dinero al cliente: sale del turno actual de quien devuelve (efectivo) o de la caja general
export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.reverse');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, refundSchema);
    const result = await refundOrder(restaurantId, input, {
      audit: buildAuditContext(request, caller, { orderId: input.orderId, reason: input.reason }),
      idempotencyKey,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/refunds POST');
  }
}
