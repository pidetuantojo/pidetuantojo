import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, omitAudit, parseBody } from '@/lib/cash/api.server';
import { reverseMovementSchema } from '@/lib/cash/cash.schemas';
import { reverseMovement } from '@/lib/cash/movements.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { movementId: string };
}

// Reverso de un movimiento de un turno aún no cerrado (después se usa una devolución)
export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.reverse');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, reverseMovementSchema);
    const movement = await reverseMovement(restaurantId, params.movementId, input, {
      audit: buildAuditContext(request, caller, { reason: input.reason }),
      idempotencyKey,
    });
    return NextResponse.json(omitAudit(movement), { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/movements reverse');
  }
}
