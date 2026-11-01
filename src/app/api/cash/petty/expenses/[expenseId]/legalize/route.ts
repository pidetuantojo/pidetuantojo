import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse } from '@/lib/cash/api.server';
import { legalizeExpense } from '@/lib/cash/petty/expenses.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { expenseId: string };
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'petty_cash.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const expense = await legalizeExpense(restaurantId, params.expenseId, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(expense);
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty/expenses/legalize POST');
  }
}
