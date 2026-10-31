import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, omitAudit, parseBody } from '@/lib/cash/api.server';
import { depositSchema } from '@/lib/cash/cash.schemas';
import { depositToBank } from '@/lib/cash/general.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Consigna efectivo de la caja general a una cuenta bancaria
export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.approve');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, depositSchema);
    const movement = await depositToBank(restaurantId, input, {
      audit: buildAuditContext(request, caller, { registerId: input.registerId }),
      idempotencyKey,
    });
    return NextResponse.json(omitAudit(movement), { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/deposits POST');
  }
}
