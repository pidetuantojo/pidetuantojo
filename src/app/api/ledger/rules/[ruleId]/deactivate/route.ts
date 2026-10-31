import { NextResponse } from 'next/server';

import { requireLedgerAccess } from '@/lib/ledger/access.server';
import { ledgerErrorResponse } from '@/lib/ledger/api.server';
import { deactivateRule } from '@/lib/ledger/rules.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { ruleId: string };
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireLedgerAccess(request, 'ledger.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const rule = await deactivateRule(restaurantId, params.ruleId, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(rule);
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/rules deactivate');
  }
}
