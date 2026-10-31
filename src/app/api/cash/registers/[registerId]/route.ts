import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { updateRegisterSchema } from '@/lib/cash/cash.schemas';
import { updateRegister } from '@/lib/cash/registers.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { registerId: string };
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.registers.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, updateRegisterSchema);
    const register = await updateRegister(restaurantId, params.registerId, input, {
      audit: buildAuditContext(request, caller, { registerId: params.registerId }),
      idempotencyKey,
    });
    return NextResponse.json(register);
  } catch (error) {
    return cashErrorResponse(error, 'cash/registers PATCH');
  }
}
