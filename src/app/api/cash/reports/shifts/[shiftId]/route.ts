import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse } from '@/lib/cash/api.server';
import { getShiftReport } from '@/lib/cash/reports.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { shiftId: string };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { restaurantId } = await requireCashAccess(request, 'cash.approve');
    return NextResponse.json(await getShiftReport(restaurantId, params.shiftId));
  } catch (error) {
    return cashErrorResponse(error, 'cash/reports shift GET');
  }
}
