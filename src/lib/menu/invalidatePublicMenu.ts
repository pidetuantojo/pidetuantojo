'use client';

import { authFetch } from '@/lib/auth/authFetch';

/**
 * Avisa al servidor que cambió algo que se ve en la carta pública, para vaciar su caché.
 * No bloquea ni falla: si no llega, la carta igual se actualiza sola en unos minutos.
 */
export function invalidatePublicMenu(restaurantId: string | undefined): void {
  if (!restaurantId) return;
  authFetch('/api/menu/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId }),
  }).catch(() => undefined);
}

/**
 * `meta` para las mutaciones que cambian la carta: el QueryProvider llama a invalidatePublicMenu al
 * terminar bien. Recibe el id del restaurante o una función que lo saca de las variables de la mutación.
 */
export function publicMenuMeta<V>(restaurant: string | ((variables: V) => string | undefined)) {
  return { publicMenu: restaurant };
}

/** Resuelve el restaurante de una mutación con `publicMenuMeta`. */
export function publicMenuRestaurant(meta: Record<string, unknown> | undefined, variables: unknown): string | undefined {
  const target = meta?.publicMenu;
  if (typeof target === 'string') return target;
  if (typeof target === 'function') return (target as (v: unknown) => string | undefined)(variables);
  return undefined;
}
