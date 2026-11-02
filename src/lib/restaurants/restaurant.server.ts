// SOLO servidor: restaurante tal como lo ve el público (menú y checkout).
import { adminDb } from '@/lib/firebase/admin';
import { applyPlanFeatures } from '@/lib/permissions/planFeatures';
import { getSubscriptionInfo } from '@/lib/subscription/subscription';
import type { Plan, Restaurant } from '@/types';

/** Sin lecturas: ¿suspendida, sabiendo ya el período del plan? (la carta lo usa con datos en caché). */
export function isSuspendedWith(restaurant: Restaurant, billingPeriod?: 'monthly' | 'yearly'): boolean {
  if (!restaurant.planId || (!restaurant.subscriptionEndDate && !restaurant.subscriptionStartDate)) return false;
  return getSubscriptionInfo(restaurant, billingPeriod).status === 'suspended';
}

/** Período de cobro del plan (mensual / anual). */
export async function getPlanBillingPeriod(planId: string | undefined): Promise<'monthly' | 'yearly' | undefined> {
  if (!planId) return undefined;
  const planSnap = await adminDb.collection('plans').doc(planId).get();
  return planSnap.exists ? (planSnap.data() as Plan).billingPeriod : undefined;
}

/** ¿La suscripción del restaurante está suspendida? (el menú y el checkout se bloquean). */
export async function isRestaurantSuspended(restaurant: Restaurant): Promise<boolean> {
  // Mensual es el vencimiento más temprano: si así no está suspendido, no hace falta leer el plan
  if (!isSuspendedWith(restaurant, 'monthly')) return false;
  return isSuspendedWith(restaurant, await getPlanBillingPeriod(restaurant.planId));
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
