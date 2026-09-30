import type { Restaurant } from '@/types';

export type SubscriptionStatus = 'active' | 'grace_period' | 'suspended' | 'no_plan';

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  endDate: Date | null;
  gracePeriodEnd: Date | null;
  daysUntilEnd: number | null; // negative = past due
  graceDaysLeft: number | null; // business days left in grace period
}

/** Add N business days (Mon–Fri) to a date */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
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

export function getSubscriptionInfo(
  restaurant: Restaurant,
  billingPeriod?: 'monthly' | 'yearly',
): SubscriptionInfo {
  if (!restaurant.planId || !restaurant.subscriptionStartDate) {
    return {
      status: 'no_plan',
      endDate: null,
      gracePeriodEnd: null,
      daysUntilEnd: null,
      graceDaysLeft: null,
    };
  }

  const start = new Date(restaurant.subscriptionStartDate);
  const days = billingPeriod === 'yearly' ? 365 : 30;
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + days);

  const gracePeriodEnd = addBusinessDays(endDate, 5);
  const now = new Date();

  const daysUntilEnd = Math.ceil(
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (now < endDate) {
    return { status: 'active', endDate, gracePeriodEnd, daysUntilEnd, graceDaysLeft: null };
  }
  if (now < gracePeriodEnd) {
    const graceDaysLeft = businessDaysUntil(gracePeriodEnd);
    return { status: 'grace_period', endDate, gracePeriodEnd, daysUntilEnd, graceDaysLeft };
  }
  return {
    status: 'suspended',
    endDate,
    gracePeriodEnd,
    daysUntilEnd: null,
    graceDaysLeft: 0,
  };
}
