// SOLO servidor: cliente de Cloudinary con las credenciales del entorno.
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

const toDataUri = async (file: File) => `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;

/**
 * Sube un archivo PRIVADO (comprobantes de pago): no tiene URL pública; solo se ve con
 * `privateFileUrl`, que firma un enlace temporal.
 */
export async function uploadPrivateFile(file: File, folder: string): Promise<{ publicId: string; format: string }> {
  const result = await cloudinary.uploader.upload(await toDataUri(file), { folder, type: 'private', resource_type: 'image' });
  return { publicId: result.public_id, format: result.format };
}

/** Enlace temporal (por defecto 5 minutos) a un archivo privado. */
export function privateFileUrl(publicId: string, format: string, expiresInSeconds = 300): string {
  return cloudinary.utils.private_download_url(publicId, format, {
    type: 'private',
    resource_type: 'image',
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
  });
}

export async function deletePrivateFile(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { type: 'private', resource_type: 'image' });
}
