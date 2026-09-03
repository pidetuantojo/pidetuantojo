import { adminDb } from '@/lib/firebase/admin';
import type { Restaurant } from '@/types';
import { HomeClient } from '@/features/home/HomeClient';

export const dynamic = 'force-dynamic';

async function getActiveRestaurants(): Promise<Restaurant[]> {
  const snap = await adminDb
    .collection('restaurants')
    .where('isActive', '==', true)
    .get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Restaurant));
}

export default async function HomePage() {
  const restaurants = await getActiveRestaurants();
  return <HomeClient restaurants={restaurants} />;
}
