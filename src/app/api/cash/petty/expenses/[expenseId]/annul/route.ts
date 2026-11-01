import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { annulExpense } from '@/lib/cash/petty/expenses.server';
import { annulExpenseSchema } from '@/lib/cash/petty/petty.schemas';
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
    const input = await parseBody(request, annulExpenseSchema);
    const expense = await annulExpense(restaurantId, params.expenseId, input.reason, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(expense);
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty/expenses/annul POST');
  }
}
