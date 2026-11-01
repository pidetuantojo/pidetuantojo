import { NextResponse } from 'next/server';

import { requireLedgerAccess } from '@/lib/ledger/access.server';
import { ledgerErrorResponse } from '@/lib/ledger/api.server';
import { journalQuerySchema, searchParamsObject } from '@/lib/ledger/reports.schemas';
import { getJournal } from '@/lib/ledger/reports.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireLedgerAccess(request, 'ledger.view');
    const input = journalQuerySchema.parse(searchParamsObject(request));
    return NextResponse.json(await getJournal(restaurantId, input));
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/journal GET');
  }
}
