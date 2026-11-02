import { ymdToDate } from '@/lib/subscription/billing';
import { PAYMENT_METHODS } from '@/lib/subscription/payment.schema';
import type { SubscriptionPaymentMethod } from '@/types';

/** "17 dic 2026" de una fecha YYYY-MM-DD de Colombia. */
export function fmtYmd(ymd: string): string {
  return ymdToDate(ymd).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
}

export const methodLabel = (method: SubscriptionPaymentMethod) => PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;

/** "1 mes", "3 meses", "1 año". */
export function periodsLabel(periods: number, billingPeriod: 'monthly' | 'yearly'): string {
  if (billingPeriod === 'yearly') return periods === 1 ? '1 año' : `${periods} años`;
  return periods === 1 ? '1 mes' : `${periods} meses`;
}
