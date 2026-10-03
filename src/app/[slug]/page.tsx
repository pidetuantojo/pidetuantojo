import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { categoriesService } from '@/features/categories/services/categories.service';
import { adicionalesService } from '@/features/adicionales/services/adicionales.service';
import { MenuPage } from '@/features/menu/components/MenuPage';
import { ComingSoon } from '@/features/menu/components/ComingSoon';
import { productsService } from '@/features/products/services/products.service';
import { restaurantsService } from '@/features/restaurants/services/restaurants.service';
import { orderStatusesService } from '@/features/order-statuses/services/order-statuses.service';
import { deliveryZonesService } from '@/features/delivery-zones/services/delivery-zones.service';
import { mesasService } from '@/features/delivery-methods/services/mesas.service';
import { applyPlanFeatures } from '@/lib/permissions/planFeatures';
import { loadActivePromotions, menuPromotions, promotionFeatures } from '@/lib/promotions/promotions.server';
import { isRestaurantSuspended } from '@/lib/restaurants/restaurant.server';
import { getMissingRestaurantFields } from '@/features/restaurants/helpers/getMissingRestaurantFields';

// Promociones con horario, productos agotados y precios: siempre lo último (sin caché estática)
export const dynamic = 'force-dynamic';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const restaurant = await restaurantsService.getBySlug(params.slug);
  if (!restaurant) return { title: 'Restaurante no encontrado' };
  if (getMissingRestaurantFields(restaurant).length > 0) {
    return {
      title: `${restaurant.name} — Próximamente`,
      robots: { index: false },
    };
  }
  return {
    title: restaurant.name,
    description: restaurant.description,
  };
}

export default async function RestaurantMenuPage({ params }: Props) {
  const stored = await restaurantsService.getBySlug(params.slug);

  if (!stored || !stored.isActive) {
    notFound();
  }

  // Bloquear menú si la suscripción está suspendida
  if (await isRestaurantSuspended(stored)) notFound();

  // Lo que el plan no incluye no se ofrece en el menú (mesa, programados, zonas, cuentas de pago)
  const restaurant = applyPlanFeatures(stored);

  // Configuración incompleta → pantalla "Próximamente" (ahorra lecturas a Firestore)
  if (getMissingRestaurantFields(restaurant).length > 0) {
    return <ComingSoon restaurant={restaurant} />;
  }

  const mesaMethodActive = restaurant.deliveryMethods?.mesa?.isActive ?? false;

  const [categories, products, adicionales, statuses, allZones, allMesas, promotions] = await Promise.all([
    categoriesService.getAll(restaurant.id),
    productsService.getAll(restaurant.id),
    adicionalesService.getAll(restaurant.id),
    orderStatusesService.getAll(restaurant.id),
    restaurant.deliveryMode === 'zones'
      ? deliveryZonesService.getAll(restaurant.id)
      : Promise.resolve([]),
    mesaMethodActive ? mesasService.getAll(restaurant.id) : Promise.resolve([]),
    // Sin cupones (no se revela el código) y solo lo que el plan incluye
    // Si fallan, el menú se muestra igual (sin promociones)
    loadActivePromotions(restaurant).then(menuPromotions).catch((err) => {
      console.error('[menu] No se pudieron cargar las promociones:', err);
      return [];
    }),
  ]);

  const activeCategories = categories.filter((c) => c.isActive);
  const activeProducts = products.filter((p) => p.isActive);
  const activeAdicionales = adicionales.filter((a) => a.isActive);
  const receivedStatusId = statuses.find((s) => s.code === 'received')?.id ?? '';
  const deliveryZones = allZones.filter((z) => z.isActive);
  const mesas = allMesas.filter((m) => m.isActive);

  return (
    <MenuPage
      restaurant={restaurant}
      categories={activeCategories}
      products={activeProducts}
      adicionales={activeAdicionales}
      receivedStatusId={receivedStatusId}
      deliveryZones={deliveryZones}
      deliveryMode={restaurant.deliveryMode ?? 'manual'}
      mesas={mesas}
      promotions={promotions}
      couponsEnabled={promotionFeatures(restaurant).advanced}
    />
  );
}
