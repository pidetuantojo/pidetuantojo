import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { approveCloseSchema } from '@/lib/cash/cash.schemas';
import { approveClose } from '@/lib/cash/closing.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { shiftId: string };
}

// Aprobación del cierre con diferencia; el supervisor puede reasignar la cuenta del faltante
export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.approve');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, approveCloseSchema);
    const closing = await approveClose(restaurantId, params.shiftId, input, {
      audit: buildAuditContext(request, caller, { shiftId: params.shiftId, reason: input.note }),
      idempotencyKey,
    });
    return NextResponse.json(closing);
  } catch (error) {
    return cashErrorResponse(error, 'cash/shifts approve');
  }
}
