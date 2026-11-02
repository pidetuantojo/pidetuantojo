import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { MenuPage } from '@/features/menu/components/MenuPage';
import { ComingSoon } from '@/features/menu/components/ComingSoon';
import { MESA_QUERY_PARAM, resolveMesaParam } from '@/features/delivery-methods/helpers/mesaQr.helpers';
import { getMenuCatalog, getMenuPlanBillingPeriod, getMenuRestaurant } from '@/lib/menu/publicMenu.server';
import { applyPlanFeatures } from '@/lib/permissions/planFeatures';
import { menuPromotions, promotionFeatures, selectActivePromotions } from '@/lib/promotions/promotions.server';
import { isSuspendedWith } from '@/lib/restaurants/restaurant.server';
import { getMissingRestaurantFields } from '@/features/restaurants/helpers/getMissingRestaurantFields';

// La página se arma en cada visita (QR de mesa, promociones según la hora), pero los datos salen de la caché
// de la carta (src/lib/menu/publicMenu.server.ts): se leen de Firestore solo cuando el restaurante cambia algo.
export const dynamic = 'force-dynamic';

interface Props {
  params: { slug: string };
  // ?mesa={mesaId} viene del QR pegado en la mesa
  searchParams?: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const restaurant = await getMenuRestaurant(params.slug);
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

export default async function RestaurantMenuPage({ params, searchParams }: Props) {
  const stored = await getMenuRestaurant(params.slug);

  if (!stored || !stored.isActive) {
    notFound();
  }

  // Bloquear menú si la suscripción está suspendida
  if (isSuspendedWith(stored, await getMenuPlanBillingPeriod(stored.planId))) notFound();

  // Lo que el plan no incluye no se ofrece en el menú (mesa, programados, zonas, cuentas de pago)
  const restaurant = applyPlanFeatures(stored);

  // Configuración incompleta → pantalla "Próximamente" (ahorra lecturas a Firestore)
  if (getMissingRestaurantFields(restaurant).length > 0) {
    return <ComingSoon restaurant={restaurant} />;
  }

  const mesaMethodActive = restaurant.deliveryMethods?.mesa?.isActive ?? false;

  const { categories, products, adicionales, statuses, zones: allZones, mesas: allMesas, promotions: storedPromotions } = await getMenuCatalog(restaurant.id, {
    zones: restaurant.deliveryMode === 'zones',
    mesas: mesaMethodActive,
    promotions: promotionFeatures(restaurant).promotions,
  });
  // Vigentes a esta hora, sin cupones (no se revela el código) y solo lo que el plan incluye
  const promotions = menuPromotions(selectActivePromotions(restaurant, storedPromotions));

  const activeCategories = categories.filter((c) => c.isActive);
  const activeProducts = products.filter((p) => p.isActive);
  const activeAdicionales = adicionales.filter((a) => a.isActive);
  const receivedStatusId = statuses.find((s) => s.code === 'received')?.id ?? '';
  const deliveryZones = allZones.filter((z) => z.isActive);
  const mesas = allMesas.filter((m) => m.isActive);
  // Con el método mesa apagado (o sin la función en el plan) `mesas` llega vacío: el QR se ignora
  const initialMesa = resolveMesaParam(searchParams?.[MESA_QUERY_PARAM], mesas);

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
      initialMesaId={initialMesa?.id}
      promotions={promotions}
      couponsEnabled={promotionFeatures(restaurant).advanced}
    />
  );
}
