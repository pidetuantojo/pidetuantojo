import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, omitAudit, parseBody } from '@/lib/cash/api.server';
import { decideWithdrawalSchema } from '@/lib/cash/cash.schemas';
import { decideWithdrawal } from '@/lib/cash/movements.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { shiftId: string; movementId: string };
}

// Aprobar o rechazar un retiro parcial pendiente (distinto del cajero que lo registró)
export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.approve');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, decideWithdrawalSchema);
    const movement = await decideWithdrawal(
      restaurantId,
      params.shiftId,
      params.movementId,
      input,
      {
        audit: buildAuditContext(request, caller, { shiftId: params.shiftId, reason: input.note }),
        idempotencyKey,
      }
    );
    return NextResponse.json(omitAudit(movement));
  } catch (error) {
    return cashErrorResponse(error, 'cash/shifts withdrawal approve');
  }
}
