import type { Restaurant } from '@/types';

import { currentEndYmd, graceEndYmd, ymdToDate } from './billing';

export type SubscriptionStatus = 'active' | 'grace_period' | 'suspended' | 'no_plan';

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  endDate: Date | null;
  gracePeriodEnd: Date | null;
  daysUntilEnd: number | null; // negative = past due
  graceDaysLeft: number | null; // business days left in grace period
  // En los días gratis de prueba (restaurante nuevo que todavía no pagó)
  inTrial: boolean;
}

/** Count remaining business days between now and a future date */
function businessDaysUntil(target: Date): number {
  const now = new Date();
  if (target <= now) return 0;
  let count = 0;
  const cursor = new Date(now);
  while (cursor < target) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * Estado de la suscripción. El vencimiento sale de `subscriptionEndDate` (lo mueve cada pago registrado);
 * los restaurantes anteriores al registro de pagos lo calculan como inicio + 30 o 365 días.
 */
export function getSubscriptionInfo(
  restaurant: Restaurant,
  billingPeriod?: 'monthly' | 'yearly',
): SubscriptionInfo {
  const endYmd = restaurant.planId ? currentEndYmd(restaurant, billingPeriod) : null;
  if (!endYmd) {
    return { status: 'no_plan', endDate: null, gracePeriodEnd: null, daysUntilEnd: null, graceDaysLeft: null, inTrial: false };
  }

  const endDate = ymdToDate(endYmd);
  // La gracia cubre hasta el final de su último día hábil
  const gracePeriodEnd = ymdToDate(graceEndYmd(endYmd));
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 1);
  const now = new Date();

  const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const inTrial = !!restaurant.subscriptionTrialEndDate && !restaurant.lastSubscriptionPaymentId;

  if (now < endDate) {
    return { status: 'active', endDate, gracePeriodEnd, daysUntilEnd, graceDaysLeft: null, inTrial };
  }
  if (now < gracePeriodEnd) {
    return { status: 'grace_period', endDate, gracePeriodEnd, daysUntilEnd, graceDaysLeft: businessDaysUntil(gracePeriodEnd), inTrial };
  }
  return { status: 'suspended', endDate, gracePeriodEnd, daysUntilEnd: null, graceDaysLeft: 0, inTrial };
}
