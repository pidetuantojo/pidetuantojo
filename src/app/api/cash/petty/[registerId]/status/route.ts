import { NextResponse } from 'next/server';

import { cashErrorResponse } from '@/lib/cash/api.server';
import { PETTY_VIEW_PERMISSIONS, requirePettyAccess } from '@/lib/cash/petty/access.server';
import { getPettyStatus } from '@/lib/cash/petty/status.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { registerId: string };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { restaurantId } = await requirePettyAccess(request, PETTY_VIEW_PERMISSIONS);
    return NextResponse.json(await getPettyStatus(restaurantId, params.registerId));
  } catch (error) {
    return cashErrorResponse(error, 'cash/petty status GET');
  }
}
