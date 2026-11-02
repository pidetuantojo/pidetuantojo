// SOLO servidor: datos de la carta pública con caché (Next data cache).
// Antes cada visita leía ~130 documentos; ahora se leen una vez y se reutilizan hasta que el restaurante
// cambia algo (el panel llama a /api/menu/revalidate) o pasan MENU_CACHE_SECONDS.
// En caché va solo lo GUARDADO; lo que depende de la hora (promociones vigentes, suspensión) se calcula
// en cada visita. El checkout no usa esta caché: precios y disponibilidad se validan siempre contra Firestore.
import { unstable_cache } from 'next/cache';

import { adicionalesService } from '@/features/adicionales/services/adicionales.service';
import { categoriesService } from '@/features/categories/services/categories.service';
import { mesasService } from '@/features/delivery-methods/services/mesas.service';
import { deliveryZonesService } from '@/features/delivery-zones/services/delivery-zones.service';
import { orderStatusesService } from '@/features/order-statuses/services/order-statuses.service';
import { productsService } from '@/features/products/services/products.service';
import { restaurantsService } from '@/features/restaurants/services/restaurants.service';
import { fetchActivePromotions } from '@/lib/promotions/promotions.server';
import { getPlanBillingPeriod } from '@/lib/restaurants/restaurant.server';

import { MENU_TAG, menuSlugTag, menuTag } from './menuCache.server';

// Red de seguridad por si algún cambio no avisó (p. ej. los usos de una promoción, que suma cada pedido)
export const MENU_CACHE_SECONDS = 10 * 60;


export const getMenuRestaurant = (slug: string) => unstable_cache(
  () => restaurantsService.getBySlug(slug),
  ['menu-restaurant', slug],
  { tags: [MENU_TAG, menuSlugTag(slug)], revalidate: MENU_CACHE_SECONDS },
)();

export const getMenuPlanBillingPeriod = (planId: string | undefined) => (planId
  ? unstable_cache(() => getPlanBillingPeriod(planId), ['menu-plan', planId], { tags: [MENU_TAG], revalidate: MENU_CACHE_SECONDS })()
  : Promise.resolve(undefined));

export interface MenuCatalogOptions {
  zones: boolean;
  mesas: boolean;
  promotions: boolean;
}

/** Catálogo completo del restaurante (sin filtrar activos: eso se hace al armar la página). */
export const getMenuCatalog = (restaurantId: string, opts: MenuCatalogOptions) => unstable_cache(
  async () => {
    const [categories, products, adicionales, statuses, zones, mesas, promotions] = await Promise.all([
      categoriesService.getAll(restaurantId),
      productsService.getAll(restaurantId),
      adicionalesService.getAll(restaurantId),
      orderStatusesService.getAll(restaurantId),
      opts.zones ? deliveryZonesService.getAll(restaurantId) : Promise.resolve([]),
      opts.mesas ? mesasService.getAll(restaurantId) : Promise.resolve([]),
      // Si fallan, la carta se muestra igual (sin promociones)
      opts.promotions
        ? fetchActivePromotions(restaurantId).catch((err) => {
          console.error('[menu] No se pudieron cargar las promociones:', err);
          return [];
        })
        : Promise.resolve([]),
    ]);
    return { categories, products, adicionales, statuses, zones, mesas, promotions };
  },
  ['menu-catalog', restaurantId, String(opts.zones), String(opts.mesas), String(opts.promotions)],
  { tags: [MENU_TAG, menuTag(restaurantId)], revalidate: MENU_CACHE_SECONDS },
)();
