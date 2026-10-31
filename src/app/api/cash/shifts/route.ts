import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse, omitAudit, parseBody } from '@/lib/cash/api.server';
import { openShiftSchema, shiftStatusQuerySchema } from '@/lib/cash/cash.schemas';
import { listShifts, openShift } from '@/lib/cash/shifts.server';
import { buildAuditContext } from '@/lib/shared/audit.server';
import { readIdempotencyKey } from '@/lib/shared/idempotency.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Supervisores: lista de turnos, opcionalmente filtrada por estado
export async function GET(request: Request) {
  try {
    const { restaurantId } = await requireCashAccess(request, 'cash.approve');
    const status = shiftStatusQuerySchema.parse(
      new URL(request.url).searchParams.get('status') ?? undefined
    );
    const shifts = await listShifts(restaurantId, status);
    return NextResponse.json({ shifts: shifts.map(omitAudit) });
  } catch (error) {
    return cashErrorResponse(error, 'cash/shifts GET');
  }
}

// El cajero abre su turno contando la base recibida
export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.operate');
    const idempotencyKey = readIdempotencyKey(request);
    const input = await parseBody(request, openShiftSchema);
    const shift = await openShift(restaurantId, input, {
      audit: buildAuditContext(request, caller, { registerId: input.registerId }),
      idempotencyKey,
    });
    return NextResponse.json(omitAudit(shift), { status: 201 });
  } catch (error) {
    return cashErrorResponse(error, 'cash/shifts POST');
  }
}
