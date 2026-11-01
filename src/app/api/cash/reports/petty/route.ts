import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse } from '@/lib/cash/api.server';
import { pettyReportQuerySchema } from '@/lib/cash/reports.schemas';
import { getPettyReport } from '@/lib/cash/reports.server';
import { searchParamsObject } from '@/lib/ledger/reports.schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireCashAccess(request, 'petty_cash.manage');
    const input = pettyReportQuerySchema.parse(searchParamsObject(request));
    return NextResponse.json(await getPettyReport(restaurantId, input));
  } catch (error) {
    return cashErrorResponse(error, 'cash/reports petty GET');
  }
}
