import { NextRequest, NextResponse } from 'next/server';

import { AuthError, errorResponse, getCaller } from '@/lib/auth/serverAuth';
import { cloudinary } from '@/lib/cloudinary/cloudinary.server';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_BYTES = 5 * 1024 * 1024;

// Imágenes públicas del panel (logos, banners, productos, promociones). Solo usuarios con sesión:
// sin esto cualquiera podía subir archivos a nuestra cuenta de Cloudinary.
export async function POST(request: NextRequest) {
  try {
    await getCaller(request);
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'La imagen pesa más de 5 MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'antojo-app',
      resource_type: 'image',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error, 'No autenticado');
    console.error('Cloudinary upload error:', error);
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 });
  }
}
