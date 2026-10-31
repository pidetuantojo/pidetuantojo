import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { createRegisterSchema } from '@/lib/cash/cash.schemas';
import { createRegister, listRegisters } from '@/lib/cash/registers.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireCashAccess(request, 'cash.view');
    return NextResponse.json({ registers: await listRegisters(restaurantId) });
  } catch (error) {
    return cashErrorResponse(error, 'cash/registers GET');
  }
}

export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.registers.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, createRegisterSchema);
    const register = await createRegister(restaurantId, input, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(register, { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/registers POST');
  }
}
