import { NextResponse } from 'next/server';

import { errorResponse, requirePermission } from '@/lib/auth/serverAuth';
import { buildTestPush } from '@/lib/push/payload';
import { sendPush, userTokens } from '@/lib/push/push.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "Enviar prueba": manda un aviso a los dispositivos del usuario (sin crear pedidos reales)
export async function POST(request: Request) {
  try {
    const caller = await requirePermission(request, 'orders.view');
    const result = await sendPush(await userTokens(caller.uid), buildTestPush());
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, 'No se pudo enviar la prueba');
  }
}
