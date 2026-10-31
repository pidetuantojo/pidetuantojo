import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { getActivation, setActivation } from '@/lib/cash/activation.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { setActivationSchema } from '@/lib/cash/cash.schemas';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireCashAccess(request, 'cash.registers.manage');
    return NextResponse.json(await getActivation(restaurantId));
  } catch (error) {
    return cashErrorResponse(error, 'cash/activation GET');
  }
}

export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.registers.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, setActivationSchema);
    const status = await setActivation(restaurantId, input, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(status);
  } catch (error) {
    return cashErrorResponse(error, 'cash/activation POST');
  }
}
