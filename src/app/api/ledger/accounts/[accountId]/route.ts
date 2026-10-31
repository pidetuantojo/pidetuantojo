import { NextResponse } from 'next/server';

import { requireLedgerAccess } from '@/lib/ledger/access.server';
import { updateAccount } from '@/lib/ledger/accounts.server';
import { ledgerErrorResponse, parseBody } from '@/lib/ledger/api.server';
import { updateAccountSchema } from '@/lib/ledger/ledger.schemas';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { accountId: string };
}

// Solo name, isActive, allowsMovements, needsAccountantReview (y class/nature mientras no tenga movimientos)
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireLedgerAccess(request, 'ledger.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const patch = await parseBody(request, updateAccountSchema);
    const account = await updateAccount(restaurantId, params.accountId, patch, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(account);
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/accounts PATCH');
  }
}
