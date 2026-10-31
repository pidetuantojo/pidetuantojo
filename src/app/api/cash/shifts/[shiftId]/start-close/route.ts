import { NextResponse } from 'next/server';

import { hasCallerPermission, requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse } from '@/lib/cash/api.server';
import { startClose } from '@/lib/cash/closing.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { shiftId: string };
}

// El cajero del turno (o un supervisor) inicia el cierre: ya no se aceptan movimientos
export async function POST(request: Request, { params }: Params) {
  try {
    const access = await requireCashAccess(request, 'cash.operate');
    const idempotencyKey = readIdempotencyKey(request);
    const ack = await startClose(
      access.restaurantId,
      params.shiftId,
      { canApprove: hasCallerPermission(access, 'cash.approve') },
      {
        audit: buildAuditContext(request, access.caller, { shiftId: params.shiftId }),
        idempotencyKey,
      }
    );
    return NextResponse.json(ack);
  } catch (error) {
    return cashErrorResponse(error, 'cash/shifts start-close');
  }
}
