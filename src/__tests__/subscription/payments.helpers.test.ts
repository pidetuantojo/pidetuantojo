import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  dueRestaurants, filterPayments, paymentMonths, previousMonth, sumPayments,
} from '@/features/subscriptions/helpers/payments.helpers';
import type { Plan, Restaurant, SubscriptionPayment } from '@/types';

const pay = (id: string, extra: Partial<SubscriptionPayment>) => ({
  id, restaurantId: 'r1', amount: 80000, paidAt: '2026-11-02', method: 'nequi', status: 'registered', createdAt: '2026-11-02T10:00:00Z', ...extra,
}) as SubscriptionPayment;

describe('resumen de pagos', () => {
  const payments = [
    pay('a', {}),
    pay('b', { amount: 50000, restaurantId: 'r2', method: 'efectivo', paidAt: '2026-10-20' }),
    pay('c', { amount: 999999, status: 'voided' }),
  ];

  it('los anulados no suman', () => {
    expect(sumPayments(payments)).toEqual({ total: 130000, count: 2 });
  });

  it('filtra por mes, restaurante y medio; los anulados solo si se piden', () => {
    expect(filterPayments(payments, { month: '2026-11' }).map((p) => p.id)).toEqual(['a']);
    expect(filterPayments(payments, { month: '2026-11', showVoided: true }).map((p) => p.id)).toEqual(['a', 'c']);
    expect(filterPayments(payments, { restaurantId: 'r2' }).map((p) => p.id)).toEqual(['b']);
    expect(filterPayments(payments, { method: 'efectivo' }).map((p) => p.id)).toEqual(['b']);
  });

  it('meses con pagos y mes anterior', () => {
    expect(paymentMonths(payments)).toEqual(['2026-11', '2026-10']);
    expect(previousMonth('2026-11')).toBe('2026-10');
    expect(previousMonth('2027-01')).toBe('2026-12');
  });
});

describe('dueRestaurants', () => {
  afterEach(() => vi.useRealTimers());

  it('suspendidos, en gracia y por vencer (7 días), primero los más atrasados', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T12:00:00-05:00'));
    const r = (id: string, extra: Partial<Restaurant>) => ({ id, name: id, isActive: true, planId: 'p1', ...extra }) as Restaurant;
    const plans = [{ id: 'p1', billingPeriod: 'monthly', price: 80000 }] as Plan[];
    const due = dueRestaurants([
      r('al-dia', { subscriptionEndDate: '2026-12-20' }),
      r('por-vencer', { subscriptionEndDate: '2026-11-08' }),
      r('gracia', { subscriptionEndDate: '2026-11-01' }),
      r('suspendido', { subscriptionEndDate: '2026-10-01' }),
      r('inactivo', { subscriptionEndDate: '2026-10-01', isActive: false }),
      r('sin-plan', { planId: undefined }),
    ], plans);
    expect(due.map((d) => d.restaurant.id)).toEqual(['suspendido', 'gracia', 'por-vencer']);
    expect(due[0].plan?.price).toBe(80000);
  });
});
