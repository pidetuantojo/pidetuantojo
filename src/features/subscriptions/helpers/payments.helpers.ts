import { getSubscriptionInfo, type SubscriptionInfo } from '@/lib/subscription/subscription';
import type { Plan, Restaurant, SubscriptionPayment } from '@/types';

// Cuántos días antes de vencer un restaurante ya aparece en "Por cobrar"
export const DUE_SOON_DAYS = 7;

/** "2026-11" de una fecha YYYY-MM-DD. */
export const monthOf = (ymd: string) => ymd.slice(0, 7);

/** "noviembre 2026" de "2026-11". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Mes anterior a "2026-01" → "2025-12". */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Total y cantidad de pagos vigentes (los anulados no suman). */
export function sumPayments(payments: SubscriptionPayment[]): { total: number; count: number } {
  const valid = payments.filter((p) => p.status === 'registered');
  return { total: valid.reduce((acc, p) => acc + p.amount, 0), count: valid.length };
}

/** Meses con pagos, del más reciente al más viejo. */
export function paymentMonths(payments: SubscriptionPayment[]): string[] {
  return Array.from(new Set(payments.map((p) => monthOf(p.paidAt)))).sort().reverse();
}

export interface PaymentFilters {
  month?: string;
  restaurantId?: string;
  method?: string;
  showVoided?: boolean;
}

export function filterPayments(payments: SubscriptionPayment[], f: PaymentFilters): SubscriptionPayment[] {
  return payments.filter((p) =>
    (!f.month || monthOf(p.paidAt) === f.month)
    && (!f.restaurantId || p.restaurantId === f.restaurantId)
    && (!f.method || p.method === f.method)
    && (f.showVoided || p.status === 'registered'));
}

export interface DueItem {
  restaurant: Restaurant;
  plan?: Plan;
  info: SubscriptionInfo;
}

/**
 * A quién cobrarle: restaurantes activos con plan que están suspendidos, en gracia o por vencer
 * (incluye los que terminan la prueba gratis). Primero los más atrasados.
 */
export function dueRestaurants(restaurants: Restaurant[], plans: Plan[]): DueItem[] {
  const planById = new Map(plans.map((p) => [p.id, p]));
  return restaurants
    .filter((r) => r.isActive && r.planId)
    .map((r) => {
      const plan = planById.get(r.planId!);
      return { restaurant: r, plan, info: getSubscriptionInfo(r, plan?.billingPeriod) };
    })
    .filter(({ info }) => info.status === 'suspended' || info.status === 'grace_period'
      || (info.status === 'active' && info.daysUntilEnd !== null && info.daysUntilEnd <= DUE_SOON_DAYS))
    .sort((a, b) => (a.info.endDate?.getTime() ?? 0) - (b.info.endDate?.getTime() ?? 0));
}
