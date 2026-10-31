import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { updateSettingsSchema } from '@/lib/cash/cash.schemas';
import { getSettings, updateSettings } from '@/lib/cash/settings.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireCashAccess(request, 'cash.view');
    return NextResponse.json({ settings: await getSettings(restaurantId) });
  } catch (error) {
    return cashErrorResponse(error, 'cash/settings GET');
  }
}

export async function PUT(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.registers.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, updateSettingsSchema);
    const settings = await updateSettings(restaurantId, input, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return cashErrorResponse(error, 'cash/settings PUT');
  }
}
