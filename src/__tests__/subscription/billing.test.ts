import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addMonths, computePaymentPeriod, currentEndYmd, graceEndYmd, todayYmd, trialSubscriptionFields,
} from '@/lib/subscription/billing';
import { getSubscriptionInfo } from '@/lib/subscription/subscription';
import type { Restaurant } from '@/types';

describe('addMonths (mes calendario)', () => {
  it('conserva el día de corte y cae en el último día si el mes no lo tiene', () => {
    expect(addMonths('2026-10-31', 1)).toBe('2026-11-30');
    expect(addMonths('2026-11-30', 1, 31)).toBe('2026-12-31');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-11-02', 12)).toBe('2027-11-02');
  });
});

describe('computePaymentPeriod', () => {
  const base = { periods: 1, billingPeriod: 'monthly' as const };

  it('pago anticipado: sigue desde el vencimiento (no pierde los días que le quedaban)', () => {
    const p = computePaymentPeriod({ ...base, currentEnd: '2026-11-10', paidAt: '2026-11-01' });
    expect(p).toMatchObject({ periodStart: '2026-11-10', periodEnd: '2026-12-10', continues: true });
  });

  it('pago dentro de la gracia: sigue desde el vencimiento (la gracia no se regala)', () => {
    // Vence sábado 31 oct → gracia hasta el viernes 6 nov (5 días hábiles)
    expect(graceEndYmd('2026-10-31')).toBe('2026-11-06');
    const p = computePaymentPeriod({ ...base, currentEnd: '2026-10-31', paidAt: '2026-11-06' });
    expect(p).toMatchObject({ periodStart: '2026-10-31', periodEnd: '2026-11-30', anchorDay: 31, continues: true });
    // El siguiente mes vuelve al 31 gracias al día de corte
    const next = computePaymentPeriod({ ...base, currentEnd: p.periodEnd, anchorDay: p.anchorDay, paidAt: '2026-11-28' });
    expect(next.periodEnd).toBe('2026-12-31');
  });

  it('pago estando suspendido o primer pago: arranca el día del pago', () => {
    expect(computePaymentPeriod({ ...base, currentEnd: '2026-10-31', paidAt: '2026-11-09' }))
      .toMatchObject({ periodStart: '2026-11-09', periodEnd: '2026-12-09', anchorDay: 9, continues: false });
    expect(computePaymentPeriod({ ...base, currentEnd: null, paidAt: '2026-11-02' }).periodEnd).toBe('2026-12-02');
  });

  it('varios períodos y planes anuales', () => {
    expect(computePaymentPeriod({ ...base, periods: 3, currentEnd: '2026-11-15', paidAt: '2026-11-10' }).periodEnd).toBe('2027-02-15');
    expect(computePaymentPeriod({ periods: 1, billingPeriod: 'yearly', currentEnd: '2026-11-15', paidAt: '2026-11-10' }).periodEnd).toBe('2027-11-15');
  });

  it('restaurante nuevo: 15 días gratis y el primer pago suma el mes desde el fin de la prueba', () => {
    const trial = trialSubscriptionFields('2026-11-02');
    expect(trial).toEqual({ subscriptionEndDate: '2026-11-17', subscriptionTrialEndDate: '2026-11-17' });
    const p = computePaymentPeriod({ ...base, currentEnd: trial.subscriptionEndDate, paidAt: '2026-11-03' });
    expect(p.periodEnd).toBe('2026-12-17');
  });
});

describe('currentEndYmd', () => {
  it('usa subscriptionEndDate; si no hay, el cálculo anterior (inicio + 30 o 365 días)', () => {
    expect(currentEndYmd({ subscriptionEndDate: '2026-12-01', subscriptionStartDate: '2026-01-01T00:00:00.000Z' })).toBe('2026-12-01');
    expect(currentEndYmd({ subscriptionStartDate: '2026-10-01T00:00:00.000Z' }, 'monthly')).toBe('2026-10-31');
    expect(currentEndYmd({ subscriptionStartDate: '2026-10-01T00:00:00.000Z' }, 'yearly')).toBe('2027-10-01');
    expect(currentEndYmd({})).toBeNull();
  });
});

describe('getSubscriptionInfo', () => {
  afterEach(() => vi.useRealTimers());
  const r = (extra: Partial<Restaurant>) => ({ planId: 'p1', ...extra }) as Restaurant;

  it('activa, en gracia o suspendida según subscriptionEndDate (hora de Colombia)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T15:00:00-05:00'));
    expect(todayYmd()).toBe('2026-11-03');
    expect(getSubscriptionInfo(r({ subscriptionEndDate: '2026-11-04' })).status).toBe('active');
    // Venció el 31 oct: la gracia llega hasta el final del viernes 6 nov
    expect(getSubscriptionInfo(r({ subscriptionEndDate: '2026-10-31' })).status).toBe('grace_period');
    vi.setSystemTime(new Date('2026-11-06T23:00:00-05:00'));
    expect(getSubscriptionInfo(r({ subscriptionEndDate: '2026-10-31' })).status).toBe('grace_period');
    vi.setSystemTime(new Date('2026-11-07T00:30:00-05:00'));
    expect(getSubscriptionInfo(r({ subscriptionEndDate: '2026-10-31' })).status).toBe('suspended');
  });

  it('marca la prueba gratis solo hasta el primer pago; sin plan no aplica', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T12:00:00-05:00'));
    expect(getSubscriptionInfo(r({ subscriptionEndDate: '2026-11-17', subscriptionTrialEndDate: '2026-11-17' })).inTrial).toBe(true);
    expect(getSubscriptionInfo(r({ subscriptionEndDate: '2026-12-17', subscriptionTrialEndDate: '2026-11-17', lastSubscriptionPaymentId: 'x' })).inTrial).toBe(false);
    expect(getSubscriptionInfo({ subscriptionEndDate: '2026-12-17' } as Restaurant).status).toBe('no_plan');
  });
});
