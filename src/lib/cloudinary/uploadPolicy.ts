// Reglas puras de subida de archivos (tipos permitidos, tamaño y carpeta).
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PDF_MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PDF_TYPE = 'application/pdf';
export const ALLOWED_UPLOAD_TYPES = [...IMAGE_TYPES, PDF_TYPE];

export type UploadCheck = { ok: true; isPdf: boolean } | { ok: false; status: 413 | 415; error: string };

export function checkUpload(file: { type: string; size: number }): UploadCheck {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return { ok: false, status: 415, error: 'Tipo de archivo no permitido. Usa JPG, PNG, WebP o PDF.' };
  }
  const isPdf = file.type === PDF_TYPE;
  const max = isPdf ? PDF_MAX_BYTES : IMAGE_MAX_BYTES;
  if (file.size > max) {
    return { ok: false, status: 413, error: `El archivo supera el máximo de ${max / (1024 * 1024)} MB.` };
  }
  return { ok: true, isPdf };
}

/** Carpeta por restaurante; el super admin sin restaurante usa la raíz. */
export function uploadFolder(restaurantId: string | undefined): string | null {
  return restaurantId ? `antojo-app/${restaurantId}` : null;
}
