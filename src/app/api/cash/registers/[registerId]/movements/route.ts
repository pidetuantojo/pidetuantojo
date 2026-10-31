import { NextResponse } from 'next/server';

import { AuthError } from '@/lib/auth/serverAuth';
import { hasCallerPermission, requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, omitAudit, parseBody } from '@/lib/cash/api.server';
import { generalMovementSchema } from '@/lib/cash/cash.schemas';
import { createGeneralMovement } from '@/lib/cash/general.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { registerId: string };
}

// Ingreso/egreso en efectivo de la caja general (sin turno). El saldo inicial se carga aquí.
export async function POST(request: Request, { params }: Params) {
  try {
    const access = await requireCashAccess(request, 'cash.approve');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, generalMovementSchema);
    if (input.accountOverrideId && !hasCallerPermission(access, 'ledger.manage')) {
      throw new AuthError('Elegir la contrapartida exige permiso de administrar el libro', 403);
    }
    const movement = await createGeneralMovement(access.restaurantId, params.registerId, input, {
      audit: buildAuditContext(request, access.caller, {
        registerId: params.registerId,
        reason: input.reason,
      }),
      idempotencyKey,
    });
    return NextResponse.json(omitAudit(movement), { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/registers movements POST');
  }
}
