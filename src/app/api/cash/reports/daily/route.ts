import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse } from '@/lib/cash/api.server';
import { dailyQuerySchema } from '@/lib/cash/reports.schemas';
import { getDailySummary } from '@/lib/cash/reports.server';
import { searchParamsObject } from '@/lib/ledger/reports.schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireCashAccess(request, 'cash.approve');
    const { date } = dailyQuerySchema.parse(searchParamsObject(request));
    return NextResponse.json(await getDailySummary(restaurantId, date));
  } catch (error) {
    return cashErrorResponse(error, 'cash/reports daily GET');
  }
}
