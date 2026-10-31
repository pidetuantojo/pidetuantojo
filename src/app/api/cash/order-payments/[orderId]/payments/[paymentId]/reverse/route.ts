import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { reverseMovementSchema } from '@/lib/cash/cash.schemas';
import { reverseOrderPayment } from '@/lib/cash/order-payments.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { orderId: string; paymentId: string };
}

// Reversa un pago de pedido mientras su turno siga sin cerrarse (después, una devolución)
export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.reverse');
    const idempotencyKey = readIdempotencyKey(request);
    const { reason } = await parseBody(request, reverseMovementSchema);
    const result = await reverseOrderPayment(
      restaurantId,
      { orderId: params.orderId, paymentId: params.paymentId, reason },
      {
        audit: buildAuditContext(request, caller, { orderId: params.orderId, reason }),
        idempotencyKey,
      }
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/order-payments reverse');
  }
}
