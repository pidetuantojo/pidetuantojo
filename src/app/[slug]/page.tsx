import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { categoriesService } from '@/features/categories/services/categories.service';
import { adicionalesService } from '@/features/adicionales/services/adicionales.service';
import { MenuPage } from '@/features/menu/components/MenuPage';
import { productsService } from '@/features/products/services/products.service';
import { restaurantsService } from '@/features/restaurants/services/restaurants.service';
import { orderStatusesService } from '@/features/order-statuses/services/order-statuses.service';
import { deliveryZonesService } from '@/features/delivery-zones/services/delivery-zones.service';
import { mesasService } from '@/features/delivery-methods/services/mesas.service';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const restaurant = await restaurantsService.getBySlug(params.slug);
  if (!restaurant) return { title: 'Restaurante no encontrado' };
  return {
    title: restaurant.name,
    description: restaurant.description,
  };
}

export default async function RestaurantMenuPage({ params }: Props) {
  const restaurant = await restaurantsService.getBySlug(params.slug);

  if (!restaurant || !restaurant.isActive) {
    notFound();
  }

  const mesaMethodActive = restaurant.deliveryMethods?.mesa?.isActive ?? false;

  const [categories, products, adicionales, statuses, allZones, allMesas] = await Promise.all([
    categoriesService.getAll(restaurant.id),
    productsService.getAll(restaurant.id),
    adicionalesService.getAll(restaurant.id),
    orderStatusesService.getAll(restaurant.id),
    restaurant.deliveryMode === 'zones'
      ? deliveryZonesService.getAll(restaurant.id)
      : Promise.resolve([]),
    mesaMethodActive ? mesasService.getAll(restaurant.id) : Promise.resolve([]),
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
    />
  );
}
