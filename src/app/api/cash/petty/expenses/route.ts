import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, parseBody } from '@/lib/cash/api.server';
import { PETTY_VIEW_PERMISSIONS, requirePettyAccess } from '@/lib/cash/petty/access.server';
import { createExpense } from '@/lib/cash/petty/expenses.server';
import { expenseSchema, expenseStatusQuerySchema } from '@/lib/cash/petty/petty.schemas';
import { listExpenses } from '@/lib/cash/petty/status.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requirePettyAccess(request, PETTY_VIEW_PERMISSIONS);
    const params = new URL(request.url).searchParams;
    const registerId = params.get('registerId');
    if (!registerId) return NextResponse.json({ error: 'registerId requerido' }, { status: 400 });
    const status = expenseStatusQuerySchema.safeParse(params.get('status') ?? undefined);
    if (!status.success) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    const expenses = await listExpenses(restaurantId, { registerId, status: status.data });
    return NextResponse.json({ expenses });
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty/expenses GET');
  }
}

export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'petty_cash.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, expenseSchema);
    const expense = await createExpense(restaurantId, input, {
      audit: buildAuditContext(request, caller, { registerId: input.registerId }),
      idempotencyKey,
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty/expenses POST');
  }
}
