import { NextResponse } from 'next/server';

import { requireCashAccess } from '@/lib/cash/access.server';
import { cashErrorResponse } from '@/lib/cash/api.server';
import { getRegisterBalance } from '@/lib/cash/balance.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { registerId: string };
}

// Saldo de una caja general (incluye los espejos de traslados)
export async function GET(request: Request, { params }: Params) {
  try {
    const { restaurantId } = await requireCashAccess(request, 'cash.approve');
    return NextResponse.json(await getRegisterBalance(restaurantId, params.registerId));
  } catch (error) {
    return cashErrorResponse(error, 'cash/registers balance GET');
  }
}
