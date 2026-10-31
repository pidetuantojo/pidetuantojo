import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse } from '@/lib/cash/api.server';
import { getCurrentShift } from '@/lib/cash/shifts.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Turno vigente del cajero. Sin totales: durante el cierre el cajero no ve cifras esperadas.
export async function GET(request: Request) {
  try {
    const { caller, restaurantId } = await requireCashAccess(request, 'cash.operate');
    const shift = await getCurrentShift(restaurantId, caller.uid);
    if (!shift) return NextResponse.json({ shift: null });
    const { id, registerId, status, openedAt, openingAccountingDate } = shift;
    return NextResponse.json({
      shift: { id, registerId, status, openedAt, openingAccountingDate },
    });
  } catch (error) {
    return cashErrorResponse(error, 'cash/shifts/current GET');
  }
}
