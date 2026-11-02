import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { errorResponse, requireRole } from '@/lib/auth/serverAuth';
import { voidPaymentSchema } from '@/lib/subscription/payment.schema';
import { voidSubscriptionPayment } from '@/lib/subscription/payments.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Anular un pago (solo super admin): queda en el historial como anulado y el vencimiento vuelve al anterior.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const caller = await requireRole(request, ['super_admin']);
    const { reason } = voidPaymentSchema.parse(await request.json().catch(() => ({})));
    await voidSubscriptionPayment(params.id, reason, { uid: caller.uid, name: caller.name });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    return errorResponse(error, 'No se pudo anular el pago');
  }
}
