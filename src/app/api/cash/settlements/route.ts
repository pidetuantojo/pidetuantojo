import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { settlementSchema } from '@/lib/cash/cash.schemas';
import { registerSettlement } from '@/lib/cash/settlements.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Liquidación del datáfono: la pasarela depositó en el banco (asiento D banco / C 1380)
export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.approve');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, settlementSchema);
    const result = await registerSettlement(restaurantId, input, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/settlements POST');
  }
}
