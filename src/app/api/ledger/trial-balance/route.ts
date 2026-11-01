import { NextResponse } from 'next/server';

import { requireLedgerAccess } from '@/lib/ledger/access.server';
import { ledgerErrorResponse } from '@/lib/ledger/api.server';
import { dateRangeSchema, searchParamsObject } from '@/lib/ledger/reports.schemas';
import { getTrialBalance } from '@/lib/ledger/reports.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireLedgerAccess(request, 'ledger.view');
    const input = dateRangeSchema.parse(searchParamsObject(request));
    return NextResponse.json(await getTrialBalance(restaurantId, input));
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/trial-balance GET');
  }
}
