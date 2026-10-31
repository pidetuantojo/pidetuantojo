import { NextResponse } from 'next/server';

import { requireLedgerAccess } from '@/lib/ledger/access.server';
import { createAccount, listAccounts } from '@/lib/ledger/accounts.server';
import { ledgerErrorResponse, parseBody } from '@/lib/ledger/api.server';
import { createAccountSchema } from '@/lib/ledger/ledger.schemas';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireLedgerAccess(request, 'ledger.view');
    return NextResponse.json({ accounts: await listAccounts(restaurantId) });
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/accounts GET');
  }
}

export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireLedgerAccess(request, 'ledger.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, createAccountSchema);
    const account = await createAccount(restaurantId, input, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/accounts POST');
  }
}
