import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { PETTY_VIEW_PERMISSIONS, requirePettyAccess } from '@/lib/cash/petty/access.server';
import { createCategory, listCategories } from '@/lib/cash/petty/categories.server';
import { categorySchema } from '@/lib/cash/petty/petty.schemas';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requirePettyAccess(request, PETTY_VIEW_PERMISSIONS);
    return NextResponse.json({ categories: await listCategories(restaurantId) });
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty/categories GET');
  }
}

export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'petty_cash.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, categorySchema);
    const category = await createCategory(restaurantId, input, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty/categories POST');
  }
}
