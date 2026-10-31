import { NextResponse } from 'next/server';

import { requireLedgerAccess } from '@/lib/ledger/access.server';
import { ledgerErrorResponse, parseBody } from '@/lib/ledger/api.server';
import { reverseEntry } from '@/lib/ledger/journal.server';
import { reverseEntrySchema } from '@/lib/ledger/ledger.schemas';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { toAccountingDate } from '@/lib/shared/bogotaDate';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { entryId: string };
}

// Reversión contable hecha por el contador: crea el contra-asiento; el original queda marcado
export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireLedgerAccess(request, 'ledger.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const body = await parseBody(request, reverseEntrySchema);
    const audit = buildAuditContext(request, caller, { reason: body.reason });
    const entry = await reverseEntry(
      restaurantId,
      params.entryId,
      { reason: body.reason, accountingDate: body.accountingDate ?? toAccountingDate(new Date()) },
      audit,
      idempotencyKey
    );
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/entries reverse');
  }
}
