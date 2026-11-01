import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, omitAudit, parseBody } from '@/lib/cash/api.server';
import { PETTY_VIEW_PERMISSIONS, requirePettyAccess } from '@/lib/cash/petty/access.server';
import {
  reimbursementStatusQuerySchema,
  requestReimbursementSchema,
} from '@/lib/cash/petty/petty.schemas';
import { requestReimbursement } from '@/lib/cash/petty/reimbursements.server';
import { listReimbursements } from '@/lib/cash/petty/status.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { restaurantId } = await requirePettyAccess(request, PETTY_VIEW_PERMISSIONS);
    const params = new URL(request.url).searchParams;
    const registerId = params.get('registerId');
    if (!registerId) return NextResponse.json({ error: 'registerId requerido' }, { status: 400 });
    const status = reimbursementStatusQuerySchema.safeParse(params.get('status') ?? undefined);
    if (!status.success) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    const reimbursements = await listReimbursements(restaurantId, {
      registerId,
      status: status.data,
    });
    return NextResponse.json({ reimbursements: reimbursements.map(omitAudit) });
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty/reimbursements GET');
  }
}

export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'petty_cash.manage');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, requestReimbursementSchema);
    const reimbursement = await requestReimbursement(restaurantId, input, {
      audit: buildAuditContext(request, caller, { registerId: input.registerId }),
      idempotencyKey,
    });
    return NextResponse.json(omitAudit(reimbursement), { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty/reimbursements POST');
  }
}
