// QR por mesa: el QR solo lleva una URL (/{slug}?mesa={mesaId}). La verdad sigue en Firestore
// y el servidor valida la mesa al crear el pedido.
import type { Mesa } from '@/types';

export const MESA_QUERY_PARAM = 'mesa';

/** URL absoluta que va dentro del QR. Usa el id (no el nombre): renombrar la mesa no obliga a reimprimir. */
export function buildMesaUrl(baseUrl: string, slug: string, mesaId: string): string {
  const url = new URL(`/${encodeURIComponent(slug)}`, baseUrl);
  url.searchParams.set(MESA_QUERY_PARAM, mesaId);
  return url.toString();
}

/**
 * Resuelve el ?mesa= contra las mesas ACTIVAS que ya cargó el servidor.
 * Cualquier valor inválido (mesa borrada, inactiva, repetido, vacío) → null: el menú sigue normal.
 */
export function resolveMesaParam(raw: string | string[] | undefined | null, activeMesas: Mesa[]): Mesa | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 128) return null;
  return activeMesas.find((m) => m.id === raw) ?? null;
}

/** Nombre de archivo seguro para descargar el PNG. */
export function mesaQrFileName(restaurantSlug: string, mesaName: string): string {
  const safe = mesaName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `qr-${restaurantSlug}-${safe || 'mesa'}.png`;
}
