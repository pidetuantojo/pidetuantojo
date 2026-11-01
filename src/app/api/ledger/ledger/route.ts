import { NextResponse } from 'next/server';

import { requireLedgerAccess } from '@/lib/ledger/access.server';
import { ledgerErrorResponse } from '@/lib/ledger/api.server';
import { ledgerQuerySchema, searchParamsObject } from '@/lib/ledger/reports.schemas';
import { getLedger } from '@/lib/ledger/reports.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireLedgerAccess(request, 'ledger.view');
    const input = ledgerQuerySchema.parse(searchParamsObject(request));
    return NextResponse.json(await getLedger(restaurantId, input));
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/ledger GET');
  }
}
