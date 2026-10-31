import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

import { AuthError, errorResponse, getCaller } from '@/lib/auth/serverAuth';
import { checkUpload, uploadFolder } from '@/lib/cloudinary/uploadPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    const folder = uploadFolder(caller.restaurantId) ?? (caller.role === 'super_admin' ? 'antojo-app' : null);
    if (!folder) throw new AuthError('Tu usuario no tiene restaurante asignado', 403);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }

    const check = checkUpload(file);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;

    // PDF → "raw" (se guarda y entrega tal cual, sin transformaciones de imagen)
    const result = await cloudinary.uploader.upload(
      dataUri,
      check.isPdf
        ? { folder, resource_type: 'raw' }
        : { folder, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] }
    );

    return NextResponse.json({ url: result.secure_url });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error, 'No autorizado');
    console.error('Cloudinary upload error:', error instanceof Error ? error.message : 'desconocido');
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 });
  }
}
