import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { submitCountSchema } from '@/lib/cash/cash.schemas';
import { submitCount } from '@/lib/cash/closing.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { shiftId: string };
}

// Conteo a ciegas: la respuesta es SOLO { shiftId, status }, nunca esperado ni diferencias
export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.operate');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, submitCountSchema);
    const ack = await submitCount(restaurantId, params.shiftId, input, {
      audit: buildAuditContext(request, caller, { shiftId: params.shiftId }),
      idempotencyKey,
    });
    return NextResponse.json({ shiftId: ack.shiftId, status: ack.status });
  } catch (error) {
    return cashErrorResponse(error, 'cash/shifts count');
  }
}
