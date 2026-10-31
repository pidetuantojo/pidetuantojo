import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse } from '@/lib/cash/api.server';
import { getClosing } from '@/lib/cash/closing.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { shiftId: string };
}

// Foto completa del cierre (esperado y diferencias): solo supervisores
export async function GET(request: Request, { params }: Params) {
  try {
    const { restaurantId } = await requireCashAccess(request, 'cash.approve');
    return NextResponse.json({ closing: await getClosing(restaurantId, params.shiftId) });
  } catch (error) {
    return cashErrorResponse(error, 'cash/shifts closing GET');
  }
}
