import { adminDb } from '@/lib/firebase/admin';
import type { Restaurant, Plan } from '@/types';
import { HomeClient } from '@/features/home/HomeClient';
import { getSubscriptionInfo } from '@/lib/subscription/subscription';

export const dynamic = 'force-dynamic';

async function getVisibleRestaurants(): Promise<Restaurant[]> {
  const snap = await adminDb
    .collection('restaurants')
    .where('isActive', '==', true)
    .get();
  const restaurants = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Restaurant));

  // Fetch all unique plan IDs in one pass
  const planIds = Array.from(new Set(restaurants.map((r) => r.planId).filter(Boolean) as string[]));
  const planMap: Record<string, Pick<Plan, 'billingPeriod'>> = {};
  if (planIds.length > 0) {
    await Promise.all(
      planIds.map(async (planId) => {
        const planDoc = await adminDb.collection('plans').doc(planId).get();
        if (planDoc.exists) {
          const planData = planDoc.data() as Plan;
          planMap[planId] = { billingPeriod: planData.billingPeriod };
        }
      }),
    );
  }

  // Filter out suspended restaurants
  // Restaurants with no planId or no subscriptionStartDate are legacy = always visible
  return restaurants.filter((r) => {
    const billingPeriod = r.planId ? planMap[r.planId]?.billingPeriod : undefined;
    const info = getSubscriptionInfo(r, billingPeriod);
    return info.status !== 'suspended';
  });
}

export default async function HomePage() {
  const restaurants = await getVisibleRestaurants();
  return <HomeClient restaurants={restaurants} />;
}
