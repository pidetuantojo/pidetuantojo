import { describe, expect, it } from 'vitest';

import { applyPlanFeatures, hasPlanFeature } from '@/lib/permissions/planFeatures';
import type { Restaurant } from '@/types';

function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 'r1',
    name: 'Test',
    slug: 'test',
    description: '',
    logo: '',
    phone: '',
    theme: { primaryColor: '#000', secondaryColor: '#000', accentColor: '#000', bgColor: '#fff' },
    adminUserId: 'u1',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deliveryMode: 'zones',
    allowScheduledWhenClosed: true,
    deliveryMethods: {
      recoger: { isActive: true, allowScheduled: true },
      domicilio: { isActive: true, allowScheduled: true },
      mesa: { isActive: true },
    },
    paymentMethods: [
      { id: 'efectivo', type: 'efectivo', isActive: true },
      { id: 'datafono', type: 'datafono', isActive: true },
      { id: 'n1', type: 'nequi', isActive: true, account: '3001234567' },
    ],
    ...overrides,
  } as Restaurant;
}

describe('hasPlanFeature', () => {
  it('sin planFeatures (restaurante legacy) todo está habilitado', () => {
    expect(hasPlanFeature({}, 'features.dine_in')).toBe(true);
  });

  it('con planFeatures solo lo incluido', () => {
    const r = { planFeatures: ['features.printing'] };
    expect(hasPlanFeature(r, 'features.printing')).toBe(true);
    expect(hasPlanFeature(r, 'features.dine_in')).toBe(false);
  });
});

describe('applyPlanFeatures', () => {
  it('no toca un restaurante sin planFeatures', () => {
    const r = makeRestaurant();
    expect(applyPlanFeatures(r)).toBe(r);
  });

  it('con todas las features deja la configuración igual', () => {
    const r = makeRestaurant({
      planFeatures: [
        'features.scheduled_orders', 'features.dine_in', 'features.delivery_zones',
        'features.payment_accounts',
      ],
    });
    const out = applyPlanFeatures(r);
    expect(out.deliveryMode).toBe('zones');
    expect(out.deliveryMethods?.mesa?.isActive).toBe(true);
    expect(out.deliveryMethods?.recoger?.allowScheduled).toBe(true);
    expect(out.paymentMethods).toHaveLength(3);
  });

  it('sin features apaga mesa, programados, zonas y cuentas de pago', () => {
    const r = makeRestaurant({ planFeatures: [] });
    const out = applyPlanFeatures(r);
    expect(out.allowScheduledWhenClosed).toBe(false);
    expect(out.deliveryMethods?.recoger).toEqual({ isActive: true, allowScheduled: false });
    expect(out.deliveryMethods?.domicilio).toEqual({ isActive: true, allowScheduled: false });
    expect(out.deliveryMethods?.mesa?.isActive).toBe(false);
    expect(out.deliveryMode).toBe('manual');
    expect(out.paymentMethods).toEqual([{ id: 'efectivo', type: 'efectivo', isActive: true }]);
  });

  it('sin cuentas de pago y con efectivo desactivado deja efectivo por defecto', () => {
    const r = makeRestaurant({
      planFeatures: [],
      paymentMethods: [
        { id: 'efectivo', type: 'efectivo', isActive: false },
        { id: 'n1', type: 'nequi', isActive: true },
      ],
    });
    expect(applyPlanFeatures(r).paymentMethods).toEqual([{ id: 'efectivo', type: 'efectivo', isActive: true }]);
  });

  it('no modifica el objeto original', () => {
    const r = makeRestaurant({ planFeatures: [] });
    applyPlanFeatures(r);
    expect(r.deliveryMode).toBe('zones');
    expect(r.deliveryMethods?.mesa?.isActive).toBe(true);
  });
});
