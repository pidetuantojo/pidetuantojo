import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, omitAudit, parseBody } from '@/lib/cash/api.server';
import { setPettyFund } from '@/lib/cash/petty/fund.server';
import { fundSchema } from '@/lib/cash/petty/petty.schemas';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { registerId: string };
}

// Constituye o ajusta el fondo fijo de la caja menor (solo quien aprueba)
export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'petty_cash.approve');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, fundSchema);
    const result = await setPettyFund(restaurantId, params.registerId, input, {
      audit: buildAuditContext(request, caller, { registerId: params.registerId }),
      idempotencyKey,
    });
    return NextResponse.json({ ...result, movement: omitAudit(result.movement) }, { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty fund POST');
  }
}
