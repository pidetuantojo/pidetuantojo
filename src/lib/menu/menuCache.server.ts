// SOLO servidor: etiquetas de la caché de la carta pública y cómo vaciarla.
// Separado de publicMenu.server.ts para que las rutas que solo invalidan no carguen los servicios del catálogo.
import { revalidateTag } from 'next/cache';

import { adminDb } from '@/lib/firebase/admin';

/** Todo lo de la carta (sirve para vaciar todas, p. ej. al cambiar las funciones de un plan). */
export const MENU_TAG = 'menu';
export const menuTag = (restaurantId: string) => `menu:${restaurantId}`;
export const menuSlugTag = (slug: string) => `menu-slug:${slug}`;

/** Vacía la caché de la carta de un restaurante (catálogo y datos del restaurante). */
export async function revalidatePublicMenu(restaurantId: string): Promise<void> {
  revalidateTag(menuTag(restaurantId));
  const snap = await adminDb.collection('restaurants').doc(restaurantId).get();
  // Si ya no existe (se borró) no sabemos su slug: se vacían todas las cartas (pasa muy poco)
  if (!snap.exists) { revalidateTag(MENU_TAG); return; }
  const slug = (snap.data() as { slug?: string }).slug;
  if (slug) revalidateTag(menuSlugTag(slug));
}

/** Vacía todas las cartas (cambios de plan que afectan a muchos restaurantes). */
export function revalidateAllMenus(): void {
  revalidateTag(MENU_TAG);
}
