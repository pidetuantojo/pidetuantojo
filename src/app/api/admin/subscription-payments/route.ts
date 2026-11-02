import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { errorResponse, requireRole } from '@/lib/auth/serverAuth';
import { deletePrivateFile, uploadPrivateFile } from '@/lib/cloudinary/cloudinary.server';
import { revalidatePublicMenu } from '@/lib/menu/menuCache.server';
import { RECEIPT_MAX_BYTES, RECEIPT_TYPES, registerPaymentSchema } from '@/lib/subscription/payment.schema';
import { registerSubscriptionPayment } from '@/lib/subscription/payments.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Registrar un pago de suscripción (solo super admin). multipart/form-data con los campos del pago
// y, opcional, `receipt` (imagen o PDF del comprobante, que queda privado en Cloudinary).
export async function POST(request: Request) {
  let uploadedId: string | undefined;
  try {
    const caller = await requireRole(request, ['super_admin']);
    const form = await request.formData();
    const input = registerPaymentSchema.parse(Object.fromEntries(
      Array.from(form.entries()).filter(([, v]) => typeof v === 'string'),
    ));

    const file = form.get('receipt');
    let receipt: { publicId: string; format: string } | undefined;
    if (file instanceof File && file.size > 0) {
      if (!RECEIPT_TYPES.includes(file.type)) return NextResponse.json({ error: 'El comprobante debe ser una imagen (JPG, PNG, WEBP) o un PDF' }, { status: 400 });
      if (file.size > RECEIPT_MAX_BYTES) return NextResponse.json({ error: 'El comprobante pesa más de 5 MB' }, { status: 400 });
      receipt = await uploadPrivateFile(file, 'antojo-app/subscription-receipts');
      uploadedId = receipt.publicId;
    }

    const payment = await registerSubscriptionPayment(input, { uid: caller.uid, name: caller.name }, receipt);
    // Cambió el vencimiento: si estaba suspendido, la carta vuelve a mostrarse ya
    await revalidatePublicMenu(input.restaurantId).catch(() => undefined);
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    // Si el pago no se guardó, no dejamos el comprobante huérfano
    if (uploadedId) await deletePrivateFile(uploadedId).catch(() => undefined);
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    console.error('POST /api/admin/subscription-payments', error);
    return errorResponse(error, 'No se pudo registrar el pago');
  }
}
