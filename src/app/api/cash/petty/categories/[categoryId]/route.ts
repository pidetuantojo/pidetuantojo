import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { updateCategory } from '@/lib/cash/petty/categories.server';
import { updateCategorySchema } from '@/lib/cash/petty/petty.schemas';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { categoryId: string };
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'petty_cash.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, updateCategorySchema);
    const category = await updateCategory(restaurantId, params.categoryId, input, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(category);
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty/categories PATCH');
  }
}
