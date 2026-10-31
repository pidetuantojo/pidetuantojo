import { NextResponse } from 'next/server';

import { requireLedgerAccess } from '@/lib/ledger/access.server';
import { ledgerErrorResponse, parseBody } from '@/lib/ledger/api.server';
import { updateRuleSchema } from '@/lib/ledger/ledger.schemas';
import { updateRule } from '@/lib/ledger/rules.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { ruleId: string };
}

// "Editar" crea la versión siguiente de la regla y marca la anterior como reemplazada
export async function PUT(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireLedgerAccess(request, 'ledger.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, updateRuleSchema);
    const rule = await updateRule(restaurantId, params.ruleId, input, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(rule);
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/rules PUT');
  }
}
