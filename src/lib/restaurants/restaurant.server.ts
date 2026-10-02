// SOLO servidor: restaurante tal como lo ve el público (menú y checkout).
import { adminDb } from '@/lib/firebase/admin';
import { applyPlanFeatures } from '@/lib/permissions/planFeatures';
import { getSubscriptionInfo } from '@/lib/subscription/subscription';
import type { Plan, Restaurant } from '@/types';

/** ¿La suscripción del restaurante está suspendida? (el menú y el checkout se bloquean). */
export async function isRestaurantSuspended(restaurant: Restaurant): Promise<boolean> {
  if (!restaurant.planId || !restaurant.subscriptionStartDate) return false;
  let billingPeriod: 'monthly' | 'yearly' | undefined;
  const planSnap = await adminDb.collection('plans').doc(restaurant.planId).get();
  if (planSnap.exists) billingPeriod = (planSnap.data() as Plan).billingPeriod;
  return getSubscriptionInfo(restaurant, billingPeriod).status === 'suspended';
}

/**
 * Restaurante activo, no suspendido y con lo que su plan no incluye apagado.
 * null = no existe o no recibe pedidos.
 */
export async function loadPublicRestaurant(restaurantId: string): Promise<Restaurant | null> {
  const snap = await adminDb.collection('restaurants').doc(restaurantId).get();
  if (!snap.exists) return null;
  const stored = { ...(snap.data() as Restaurant), id: snap.id };
  if (!stored.isActive || (await isRestaurantSuspended(stored))) return null;
  return applyPlanFeatures(stored);
}
