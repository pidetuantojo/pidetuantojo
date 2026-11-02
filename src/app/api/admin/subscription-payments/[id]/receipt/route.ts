import { NextResponse } from 'next/server';

import { errorResponse, requireRole } from '@/lib/auth/serverAuth';
import { privateFileUrl } from '@/lib/cloudinary/cloudinary.server';
import { getPaymentReceipt } from '@/lib/subscription/payments.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Enlace temporal (5 min) al comprobante privado de un pago. Solo super admin.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(request, ['super_admin']);
    const receipt = await getPaymentReceipt(params.id);
    if (!receipt) return NextResponse.json({ error: 'Este pago no tiene comprobante' }, { status: 404 });
    return NextResponse.json({ url: privateFileUrl(receipt.publicId, receipt.format) });
  } catch (error) {
    return errorResponse(error, 'No se pudo abrir el comprobante');
  }
}
