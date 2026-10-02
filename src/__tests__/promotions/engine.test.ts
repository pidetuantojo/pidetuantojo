import { describe, it, expect } from 'vitest';

import {
  evaluatePromotions, getProductPromotion, ineligibilityReason, unitDiscount,
  type PricingContext, type PricingLine,
} from '@/features/promotions/engine';
import type { Promotion } from '@/types';

// Miércoles 14 de octubre de 2026, 16:00 en Colombia (21:00 UTC)
const WEDNESDAY_4PM = new Date('2026-10-14T21:00:00Z');

function promo(overrides: Partial<Promotion>): Promotion {
  return {
    id: overrides.id ?? 'p1',
    restaurantId: 'r1',
    name: overrides.name ?? 'Promo',
    type: 'item_discount',
    showInMenu: true,
    isActive: true,
    usesCount: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function line(overrides: Partial<PricingLine> & { productId: string }): PricingLine {
  return {
    key: overrides.key ?? overrides.productId,
    categoryId: 'cat-burgers',
    quantity: 1,
    unitPrice: 20000,
    additionalsPrice: 0,
    ...overrides,
  };
}

const ctx = (overrides: Partial<PricingContext> = {}): PricingContext => ({ now: WEDNESDAY_4PM, deliveryType: 'recoger', ...overrides });

describe('unitDiscount', () => {
  it('porcentaje redondeado a $50 sobre el precio final', () => {
    // 15% de 23.900 = 20.315 → 20.300 → descuento 3.600
    expect(unitDiscount({ discountKind: 'percent', discountValue: 15 }, 23900)).toBe(3600);
  });
  it('monto fijo no supera el precio', () => {
    expect(unitDiscount({ discountKind: 'amount', discountValue: 50000 }, 20000)).toBe(20000);
  });
  it('precio final fijo', () => {
    expect(unitDiscount({ discountKind: 'fixed_price', discountValue: 19900 }, 25000)).toBe(5100);
    expect(unitDiscount({ discountKind: 'fixed_price', discountValue: 30000 }, 25000)).toBe(0);
  });
});

describe('evaluatePromotions — descuentos por producto', () => {
  it('precio tachado en una categoría (no descuenta adicionales)', () => {
    const r = evaluatePromotions(
      [line({ productId: 'burger', quantity: 2, additionalsPrice: 3000 }), line({ productId: 'soda', categoryId: 'cat-drinks', unitPrice: 5000 })],
      [promo({ discountKind: 'percent', discountValue: 20, target: { scope: 'categories', categoryIds: ['cat-burgers'] } })],
      ctx()
    );
    expect(r.subtotal).toBe(2 * 23000 + 5000);
    expect(r.itemsDiscount).toBe(8000);
    expect(r.lines.find((l) => l.key === 'burger')?.discount).toBe(8000);
    expect(r.total).toBe(51000 - 8000);
  });

  it('2x1: la unidad más barata sale gratis', () => {
    const r = evaluatePromotions(
      [line({ productId: 'a', unitPrice: 20000 }), line({ productId: 'b', unitPrice: 15000 })],
      [promo({ type: 'bundle', buyQuantity: 2, payQuantity: 1, target: { scope: 'all' } })],
      ctx()
    );
    expect(r.itemsDiscount).toBe(15000);
    expect(r.lines.find((l) => l.key === 'b')?.discount).toBe(15000);
  });

  it('3x2 con 4 unidades: solo un grupo completo', () => {
    const r = evaluatePromotions(
      [line({ productId: 'emp', unitPrice: 3000, quantity: 4 })],
      [promo({ type: 'bundle', buyQuantity: 3, payQuantity: 2, target: { scope: 'products', productIds: ['emp'] } })],
      ctx()
    );
    expect(r.itemsDiscount).toBe(3000);
  });

  it('combo: precio fijo por cada juego completo', () => {
    const r = evaluatePromotions(
      [line({ productId: 'burger', unitPrice: 20000, quantity: 2 }), line({ productId: 'fries', unitPrice: 8000, quantity: 2 }), line({ productId: 'soda', unitPrice: 5000, quantity: 1 })],
      [promo({ type: 'combo', comboItems: [{ productId: 'burger', quantity: 1 }, { productId: 'fries', quantity: 1 }, { productId: 'soda', quantity: 1 }], comboPrice: 28000 })],
      ctx()
    );
    // Solo hay 1 gaseosa → 1 combo: 33.000 − 28.000
    expect(r.itemsDiscount).toBe(5000);
    expect(r.lines.reduce((a, l) => a + l.discount, 0)).toBe(5000);
  });

  it('una unidad no recibe dos descuentos: gana la promoción que más ahorra', () => {
    const r = evaluatePromotions(
      [line({ productId: 'burger', unitPrice: 20000, quantity: 2 })],
      [
        promo({ id: 'pct', name: '10%', discountKind: 'percent', discountValue: 10, target: { scope: 'all' } }),
        promo({ id: '2x1', name: '2x1', type: 'bundle', buyQuantity: 2, payQuantity: 1, target: { scope: 'all' } }),
      ],
      ctx()
    );
    expect(r.itemsDiscount).toBe(20000);
    expect(r.applied.map((a) => a.promotionId)).toEqual(['2x1']);
  });
});

describe('evaluatePromotions — total, domicilio y regalos', () => {
  const lines = [line({ productId: 'burger', unitPrice: 20000, quantity: 2 })];

  it('descuento al total con pedido mínimo y tope', () => {
    const p = promo({ type: 'order_discount', discountKind: 'percent', discountValue: 50, maxDiscount: 10000, minSubtotal: 30000, stackable: true });
    expect(evaluatePromotions(lines, [p], ctx()).orderDiscount).toBe(10000);
    expect(evaluatePromotions([line({ productId: 'x', unitPrice: 20000 })], [p], ctx()).orderDiscount).toBe(0);
  });

  it('no acumulable: no descuenta sobre productos que ya están en oferta', () => {
    const r = evaluatePromotions(
      [line({ productId: 'burger', unitPrice: 20000 }), line({ productId: 'soda', categoryId: 'drinks', unitPrice: 10000 })],
      [
        promo({ id: 'oferta', discountKind: 'amount', discountValue: 5000, target: { scope: 'products', productIds: ['burger'] } }),
        promo({ id: 'total', type: 'order_discount', discountKind: 'percent', discountValue: 10, stackable: false }),
      ],
      ctx()
    );
    // 10% solo sobre la gaseosa (10.000)
    expect(r.orderDiscount).toBe(1000);
    expect(r.discount).toBe(6000);
  });

  it('se aplica solo el mejor descuento al total', () => {
    const r = evaluatePromotions(lines, [
      promo({ id: 'a', type: 'order_discount', discountKind: 'amount', discountValue: 3000, stackable: true }),
      promo({ id: 'b', type: 'order_discount', discountKind: 'percent', discountValue: 10, stackable: true }),
    ], ctx());
    expect(r.orderDiscount).toBe(4000);
    expect(r.applied.map((a) => a.promotionId)).toEqual(['b']);
  });

  it('domicilio gratis desde un mínimo (zonas)', () => {
    const p = promo({ type: 'free_delivery', minSubtotal: 30000 });
    const r = evaluatePromotions(lines, [p], ctx({ deliveryType: 'domicilio', deliveryFee: 6000 }));
    expect(r.freeDelivery).toBe(true);
    expect(r.deliveryFee).toBe(0);
    expect(r.total).toBe(40000);
    expect(r.applied[0].amount).toBe(6000);
  });

  it('domicilio gratis en modo manual: el envío queda en 0 (no pendiente)', () => {
    const r = evaluatePromotions(lines, [promo({ type: 'free_delivery' })], ctx({ deliveryType: 'domicilio' }));
    expect(r.deliveryFee).toBe(0);
  });

  it('regalo con la compra si el producto está disponible', () => {
    const products = new Map([['soda', { name: 'Gaseosa', isAvailable: true }]]);
    const r = evaluatePromotions(lines, [promo({ type: 'gift', giftProductId: 'soda', minSubtotal: 35000 })], ctx({ products }));
    expect(r.gifts).toEqual([{ productId: 'soda', productName: 'Gaseosa', quantity: 1, promotionId: 'p1', promotionName: 'Promo' }]);
    const agotado = new Map([['soda', { name: 'Gaseosa', isAvailable: false }]]);
    expect(evaluatePromotions(lines, [promo({ type: 'gift', giftProductId: 'soda' })], ctx({ products: agotado })).gifts).toEqual([]);
  });

  it('"te faltan $X" para el beneficio más cercano', () => {
    const r = evaluatePromotions(lines, [promo({ type: 'free_delivery', minSubtotal: 50000 })], ctx({ deliveryType: '' }));
    expect(r.nudges).toEqual([{ promotionId: 'p1', name: 'Promo', missing: 10000, benefit: 'domicilio gratis' }]);
  });
});

describe('evaluatePromotions — condiciones', () => {
  const lines = [line({ productId: 'burger', unitPrice: 20000, quantity: 2 })];
  const tenPct = (overrides: Partial<Promotion> = {}) =>
    promo({ type: 'order_discount', discountKind: 'percent', discountValue: 10, stackable: true, ...overrides });

  it('días y franja horaria en hora de Colombia', () => {
    const wednesdayAfternoon = tenPct({ schedule: { daysOfWeek: [3], startTime: '15:00', endTime: '18:00' } });
    expect(evaluatePromotions(lines, [wednesdayAfternoon], ctx()).orderDiscount).toBe(4000);
    expect(evaluatePromotions(lines, [wednesdayAfternoon], ctx({ now: new Date('2026-10-14T23:30:00Z') })).orderDiscount).toBe(0);
  });

  it('franja que cruza la medianoche pertenece al día en que empezó', () => {
    const fridayNight = tenPct({ schedule: { daysOfWeek: [5], startTime: '22:00', endTime: '02:00' } });
    // Sábado 1:00 a. m. en Colombia = sábado 06:00 UTC
    expect(evaluatePromotions(lines, [fridayNight], ctx({ now: new Date('2026-10-17T06:00:00Z') })).orderDiscount).toBe(4000);
  });

  it('gracia: se respeta unos minutos después de vencer si el cliente la vio', () => {
    const until4pm = tenPct({ schedule: { startTime: '12:00', endTime: '16:00' } });
    const at4_05 = new Date('2026-10-14T21:05:00Z');
    expect(evaluatePromotions(lines, [until4pm], ctx({ now: at4_05 })).orderDiscount).toBe(0);
    expect(evaluatePromotions(lines, [until4pm], ctx({ now: at4_05, graceIds: new Set(['p1']) })).orderDiscount).toBe(4000);
  });

  it('cupón: solo aplica con el código y avisa por qué no', () => {
    const coupon = tenPct({ couponCode: 'INSTA10', minSubtotal: 50000 });
    expect(evaluatePromotions(lines, [coupon], ctx()).orderDiscount).toBe(0);
    const r = evaluatePromotions(lines, [coupon], ctx({ couponCode: ' insta10 ' }));
    expect(r.coupon).toMatchObject({ code: 'INSTA10', valid: false });
    expect(r.coupon?.message).toContain('Pedido mínimo');
    expect(evaluatePromotions(lines, [coupon], ctx({ couponCode: 'NOPE' })).coupon?.message).toContain('no existe');
    const ok = evaluatePromotions(lines, [tenPct({ couponCode: 'INSTA10' })], ctx({ couponCode: 'insta10' }));
    expect(ok.coupon).toMatchObject({ valid: true, applied: true });
    expect(ok.applied[0].couponCode).toBe('INSTA10');
  });

  it('primer pedido: nunca se asume sin saber quién es', () => {
    const first = tenPct({ firstOrderOnly: true });
    expect(evaluatePromotions(lines, [first], ctx()).orderDiscount).toBe(0);
    expect(evaluatePromotions(lines, [first], ctx({ customer: { isNew: true, promoUses: {} } })).orderDiscount).toBe(4000);
    expect(evaluatePromotions(lines, [first], ctx({ customer: { isNew: false, promoUses: {} } })).orderDiscount).toBe(0);
  });

  it('límite por cliente y límite total', () => {
    const once = tenPct({ maxUsesPerCustomer: 1 });
    expect(evaluatePromotions(lines, [once], ctx({ customer: { isNew: false, promoUses: { p1: 1 } } })).orderDiscount).toBe(0);
    expect(evaluatePromotions(lines, [tenPct({ maxUses: 50, usesCount: 50 })], ctx()).orderDiscount).toBe(0);
  });

  it('forma de entrega', () => {
    const onlyPickup = tenPct({ deliveryTypes: ['recoger'] });
    expect(evaluatePromotions(lines, [onlyPickup], ctx({ deliveryType: 'domicilio' })).orderDiscount).toBe(0);
    expect(ineligibilityReason(onlyPickup, ctx({ deliveryType: 'domicilio' }))).toContain('recoger');
  });

  it('plan: sin promociones avanzadas no aplican cupones ni combos', () => {
    const features = { promotions: true, advanced: false };
    expect(evaluatePromotions(lines, [tenPct({ couponCode: 'X' })], ctx({ couponCode: 'X', features })).orderDiscount).toBe(0);
    expect(evaluatePromotions(lines, [tenPct()], ctx({ features })).orderDiscount).toBe(4000);
    expect(evaluatePromotions(lines, [tenPct()], ctx({ features: { promotions: false, advanced: false } })).orderDiscount).toBe(0);
  });

  it('pausada no aplica', () => {
    expect(evaluatePromotions(lines, [tenPct({ isActive: false })], ctx()).orderDiscount).toBe(0);
  });
});

describe('evaluatePromotions — fidelidad', () => {
  const lines = [line({ productId: 'burger', unitPrice: 20000, quantity: 2 })];
  const config = { isActive: true, ordersRequired: 10, rewardKind: 'percent' as const, rewardValue: 100, maxReward: 30000 };

  it('canjea el premio con tope', () => {
    const r = evaluatePromotions(lines, [], ctx({ loyalty: { config, rewardAvailable: true, redeem: true } }));
    expect(r.loyaltyDiscount).toBe(30000);
    expect(r.total).toBe(10000);
    expect(r.applied[0]).toMatchObject({ type: 'loyalty', amount: 30000 });
  });

  it('sin premio disponible o sin pedirlo no descuenta', () => {
    expect(evaluatePromotions(lines, [], ctx({ loyalty: { config, rewardAvailable: false, redeem: true } })).loyaltyDiscount).toBe(0);
    expect(evaluatePromotions(lines, [], ctx({ loyalty: { config, rewardAvailable: true, redeem: false } })).loyaltyDiscount).toBe(0);
  });
});

describe('getProductPromotion', () => {
  it('precio tachado para la tarjeta del menú', () => {
    const p = promo({ discountKind: 'percent', discountValue: 20, target: { scope: 'all' } });
    expect(getProductPromotion({ id: 'b', categoryId: 'c', price: 25000 }, [p], ctx())).toMatchObject({ badge: '-20%', finalPrice: 20000 });
  });
  it('no muestra promociones con cupón ni fuera de horario', () => {
    expect(getProductPromotion({ id: 'b', categoryId: 'c', price: 25000 }, [promo({ discountKind: 'percent', discountValue: 20, couponCode: 'X' })], ctx())).toBeNull();
    const weekend = promo({ type: 'bundle', buyQuantity: 2, payQuantity: 1, schedule: { daysOfWeek: [0, 6] } });
    expect(getProductPromotion({ id: 'b', categoryId: 'c', price: 25000 }, [weekend], ctx())).toBeNull();
  });
});
