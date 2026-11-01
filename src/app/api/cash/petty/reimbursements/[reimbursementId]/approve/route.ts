import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, omitAudit, parseBody } from '@/lib/cash/api.server';
import { approveReimbursementSchema } from '@/lib/cash/petty/petty.schemas';
import { approveReimbursement } from '@/lib/cash/petty/reimbursements.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { reimbursementId: string };
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'petty_cash.approve');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, approveReimbursementSchema);
    const reimbursement = await approveReimbursement(restaurantId, params.reimbursementId, input, {
      audit: buildAuditContext(request, caller),
      idempotencyKey,
    });
    return NextResponse.json(omitAudit(reimbursement));
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty/reimbursements/approve POST');
  }
}
