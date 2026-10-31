import { NextResponse } from 'next/server';

import { hasCallerPermission, requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, omitAudit, parseBody } from '@/lib/cash/api.server';
import { listShiftMovements } from '@/lib/cash/balance.server';
import { createMovementSchema } from '@/lib/cash/cash.schemas';
import { createManualMovement } from '@/lib/cash/movements.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { shiftId: string };
}

// Ingreso vario, egreso o retiro parcial (este queda pendiente de aprobación)
export async function POST(request: Request, { params }: Params) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.operate');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, createMovementSchema);
    const movement = await createManualMovement(restaurantId, params.shiftId, input, {
      audit: buildAuditContext(request, caller, { shiftId: params.shiftId, reason: input.reason }),
      idempotencyKey,
    });
    return NextResponse.json(omitAudit(movement), { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/shifts movements POST');
  }
}

// El cajero del turno ve la lista SIN totales; un supervisor la ve con totales por medio
export async function GET(request: Request, { params }: Params) {
  try {
    const access = await requireCashAccess(request, 'cash.view');
    const view = await listShiftMovements(access.restaurantId, params.shiftId, {
      uid: access.caller.uid,
      canApprove: hasCallerPermission(access, 'cash.approve'),
    });
    return NextResponse.json(view);
  } catch (error) {
    return cashErrorResponse(error, 'cash/shifts movements GET');
  }
}
