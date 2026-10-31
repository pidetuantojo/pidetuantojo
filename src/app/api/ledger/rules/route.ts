import { NextResponse } from 'next/server';

import { requireLedgerAccess } from '@/lib/ledger/access.server';
import { ledgerErrorResponse, parseBody } from '@/lib/ledger/api.server';
import { createRuleSchema } from '@/lib/ledger/ledger.schemas';
import { createRule, listRules } from '@/lib/ledger/rules.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireLedgerAccess(request, 'ledger.view');
    return NextResponse.json({ rules: await listRules(restaurantId) });
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/rules GET');
  }
}

export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireLedgerAccess(request, 'ledger.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, createRuleSchema);
    const rule = await createRule(restaurantId, input, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/rules POST');
  }
}
