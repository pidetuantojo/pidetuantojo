// SOLO servidor (Admin SDK): promociones, clientes y fidelidad.
import { adminDb } from '@/lib/firebase/admin';
import { phoneVariants } from '@/lib/customers/phone';
import { hasPlanFeature } from '@/lib/permissions/planFeatures';
import { requiresAdvancedPlan, RESTAURANT_TIMEZONE, zonedParts } from '@/features/promotions/engine';
import type { Customer, LoyaltyConfig, Order, OrderStatus, Promotion, Restaurant } from '@/types';

export interface PromotionFeatures {
  promotions: boolean;
  advanced: boolean;
}

export function promotionFeatures(restaurant: Pick<Restaurant, 'planFeatures'>): PromotionFeatures {
  return {
    promotions: hasPlanFeature(restaurant, 'features.promotions'),
    advanced: hasPlanFeature(restaurant, 'features.promotions_advanced'),
  };
}

const promotionsRef = (restaurantId: string) => adminDb.collection('restaurants').doc(restaurantId).collection('promotions');
const customersRef = (restaurantId: string) => adminDb.collection('restaurants').doc(restaurantId).collection('customers');
const ordersRef = (restaurantId: string) => adminDb.collection('restaurants').doc(restaurantId).collection('orders');

/** Promociones activas (no pausadas) que el plan permite, sin las vencidas ni las agotadas. */
export async function loadActivePromotions(restaurant: Restaurant, now = new Date()): Promise<Promotion[]> {
  const features = promotionFeatures(restaurant);
  if (!features.promotions) return [];
  const snap = await promotionsRef(restaurant.id).where('isActive', '==', true).get();
  const today = zonedParts(now, RESTAURANT_TIMEZONE).date;
  return snap.docs
    .map((d) => ({ ...(d.data() as Promotion), id: d.id }))
    .filter((p) => features.advanced || !requiresAdvancedPlan(p))
    .filter((p) => !p.schedule?.endDate || p.schedule.endDate >= today)
    .filter((p) => !p.maxUses || (p.usesCount ?? 0) < p.maxUses);
}

/**
 * Lo que puede ver el navegador: sin contadores internos.
 * Las promociones con cupón NUNCA van al menú (se revelaría el código); se validan con /api/promotions/coupon.
 */
export function toPublicPromotion(p: Promotion): Promotion {
  const publicPromotion: Promotion = { ...p, usesCount: 0 };
  delete publicPromotion.maxUses;
  return publicPromotion;
}

export function menuPromotions(promotions: Promotion[]): Promotion[] {
  return promotions.filter((p) => !p.couponCode).map(toPublicPromotion);
}

export interface CustomerProfile {
  customer: Customer | null;
  // Nunca pidió en este restaurante (ni antes de que existiera el registro de clientes)
  isNew: boolean;
}

export async function getCustomerProfile(restaurantId: string, phoneKey: string): Promise<CustomerProfile> {
  const snap = await customersRef(restaurantId).doc(phoneKey).get();
  if (snap.exists) {
    const customer = { ...(snap.data() as Customer), id: snap.id };
    return { customer, isNew: (customer.ordersCount ?? 0) === 0 };
  }
  // Pedidos de antes del registro de clientes: se busca por las formas comunes de escribir el número
  const [byKey, legacy] = await Promise.all([
    ordersRef(restaurantId).where('customerPhoneKey', '==', phoneKey).limit(1).get(),
    ordersRef(restaurantId).where('customerPhone', 'in', phoneVariants(phoneKey)).limit(1).get(),
  ]);
  return { customer: null, isNew: byKey.empty && legacy.empty };
}

export interface LoyaltyStatus {
  config: LoyaltyConfig;
  stamps: number;
  required: number;
  rewardAvailable: boolean;
}

/**
 * Sellos de fidelidad: pedidos del cliente que el restaurante marcó como entregados o pagados
 * (desde el último canje). Así un pedido falso que nunca se entregó no suma.
 */
export async function getLoyaltyStatus(
  restaurant: Restaurant,
  phoneKey: string,
  customer: Customer | null
): Promise<LoyaltyStatus | null> {
  const config = restaurant.loyalty;
  if (!config?.isActive || !promotionFeatures(restaurant).advanced || config.ordersRequired < 1) return null;

  const [ordersSnap, statusesSnap] = await Promise.all([
    ordersRef(restaurant.id).where('customerPhoneKey', '==', phoneKey).limit(300).get(),
    adminDb.collection('restaurants').doc(restaurant.id).collection('orderStatuses').where('code', '==', 'delivered').limit(1).get(),
  ]);
  const deliveredId = statusesSnap.docs[0]?.id;
  const since = customer?.loyaltyRedeemedAt ?? '';

  const stamps = ordersSnap.docs
    .map((d) => d.data() as Order)
    .filter((o) => !o.isDeleted && o.createdAt > since)
    .filter((o) => o.isPaid === true || (!!deliveredId && o.statusId === deliveredId))
    .filter((o) => !config.minSubtotal || o.subtotal >= config.minSubtotal)
    .length;

  return { config, stamps, required: config.ordersRequired, rewardAvailable: stamps >= config.ordersRequired };
}

/** Estado base de los pedidos nuevos ("Recibido"). */
export async function getReceivedStatusId(restaurantId: string): Promise<string> {
  const snap = await adminDb.collection('restaurants').doc(restaurantId).collection('orderStatuses').get();
  const statuses = snap.docs.map((d) => ({ ...(d.data() as OrderStatus), id: d.id }));
  return statuses.find((s) => s.code === 'received')?.id
    ?? statuses.sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id
    ?? '';
}
