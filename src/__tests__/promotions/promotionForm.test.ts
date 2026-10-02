import { describe, it, expect } from 'vitest';

import {
  EMPTY_PROMOTION_FORM, duplicatePromotionForm, formToPromotion, parseAmount, promotionToForm,
  validatePromotionForm, validatePromotionStep, type PromotionFormState,
} from '@/features/promotions/helpers/promotionForm';
import type { Promotion } from '@/types';

const ctx = { advancedEnabled: true };
const form = (overrides: Partial<PromotionFormState>): PromotionFormState => ({ ...EMPTY_PROMOTION_FORM, ...overrides });

describe('parseAmount', () => {
  it('acepta puntos de miles y descarta lo demás', () => {
    expect(parseAmount('15.000')).toBe(15000);
    expect(parseAmount('$ 2.500')).toBe(2500);
    expect(parseAmount('')).toBeUndefined();
  });
});

describe('validatePromotionStep', () => {
  it('tipo obligatorio y tipos avanzados según el plan', () => {
    expect(validatePromotionStep('type', form({}), ctx)).toMatch(/Elige el tipo/);
    expect(validatePromotionStep('type', form({ type: 'combo' }), { advancedEnabled: false })).toMatch(/avanzadas/);
    expect(validatePromotionStep('type', form({ type: 'item_discount' }), { advancedEnabled: false })).toBeNull();
  });

  it('detalle de cada tipo', () => {
    expect(validatePromotionStep('detail', form({ type: 'item_discount', discountValue: '' }), ctx)).toMatch(/valor del descuento/);
    expect(validatePromotionStep('detail', form({ type: 'item_discount', discountValue: '120' }), ctx)).toMatch(/mayor a 100/);
    expect(validatePromotionStep('detail', form({ type: 'item_discount', discountValue: '20', targetScope: 'categories' }), ctx)).toMatch(/categoría/);
    expect(validatePromotionStep('detail', form({ type: 'bundle', buyQuantity: '2', payQuantity: '2' }), ctx)).toMatch(/menor/);
    expect(validatePromotionStep('detail', form({ type: 'combo', comboItems: [{ productId: 'a', quantity: 1 }], comboPrice: '20000' }), ctx)).toMatch(/al menos 2/);
    expect(validatePromotionStep('detail', form({ type: 'gift' }), ctx)).toMatch(/regalo/);
    expect(validatePromotionStep('detail', form({ type: 'free_delivery' }), ctx)).toBeNull();
  });

  it('horario', () => {
    expect(validatePromotionStep('when', form({ startDate: '2026-10-10', endDate: '2026-10-01' }), ctx)).toMatch(/posterior/);
    expect(validatePromotionStep('when', form({ startTime: '15:00' }), ctx)).toMatch(/hora de inicio y la de fin/);
    expect(validatePromotionStep('when', form({ startTime: '22:00', endTime: '02:00' }), ctx)).toBeNull();
  });

  it('cupón: formato, repetido y plan', () => {
    expect(validatePromotionStep('conditions', form({ couponCode: 'a b' }), ctx)).toMatch(/3 a 20/);
    expect(validatePromotionStep('conditions', form({ couponCode: 'insta10' }), { ...ctx, otherPromotions: [{ id: 'x', couponCode: 'INSTA10' }] })).toMatch(/otra promoción/);
    expect(validatePromotionStep('conditions', form({ couponCode: 'insta10' }), { ...ctx, otherPromotions: [{ id: 'x', couponCode: 'INSTA10' }], editingId: 'x' })).toBeNull();
    expect(validatePromotionStep('conditions', form({ couponCode: 'INSTA10' }), { advancedEnabled: false })).toMatch(/avanzadas/);
  });

  it('formulario completo devuelve el primer paso con error', () => {
    expect(validatePromotionForm(form({ type: 'order_discount', discountValue: '10' }), ctx)).toEqual({ step: 'presentation', message: expect.stringMatching(/nombre/) });
  });
});

describe('formToPromotion', () => {
  it('guarda solo los campos del tipo', () => {
    const data = formToPromotion(form({
      type: 'order_discount', name: ' 10% martes ', discountValue: '10', maxDiscount: '15.000', stackable: true,
      daysOfWeek: [3, 2], startTime: '15:00', endTime: '18:00', minSubtotal: '40.000', couponCode: ' insta10 ',
      buyQuantity: '3', comboPrice: '1000',
    }));
    expect(data).toMatchObject({
      name: '10% martes', type: 'order_discount', discountKind: 'percent', discountValue: 10, maxDiscount: 15000, stackable: true,
      schedule: { daysOfWeek: [2, 3], startTime: '15:00', endTime: '18:00' }, minSubtotal: 40000, couponCode: 'INSTA10',
      // Con cupón no se muestra en el banner (se revelaría el código)
      showInMenu: false,
    });
    expect(data.buyQuantity).toBeUndefined();
    expect(data.comboPrice).toBeUndefined();
    expect(data.target).toBeUndefined();
  });

  it('ida y vuelta con promotionToForm', () => {
    const promo: Promotion = {
      id: 'p', restaurantId: 'r', name: '2x1 empanadas', type: 'bundle', buyQuantity: 2, payQuantity: 1,
      target: { scope: 'categories', categoryIds: ['emp'] }, showInMenu: true, isActive: true, usesCount: 3, createdAt: '', updatedAt: '',
    };
    expect(formToPromotion(promotionToForm(promo))).toMatchObject({ type: 'bundle', buyQuantity: 2, payQuantity: 1, target: { scope: 'categories', categoryIds: ['emp'] } });
  });

  it('duplicar deja la copia pausada y sin cupón', () => {
    const promo: Promotion = {
      id: 'p', restaurantId: 'r', name: 'Cupón', type: 'order_discount', discountKind: 'amount', discountValue: 5000,
      couponCode: 'X1Y', showInMenu: false, isActive: true, usesCount: 0, createdAt: '', updatedAt: '',
    };
    expect(duplicatePromotionForm(promo)).toMatchObject({ name: 'Cupón (copia)', couponCode: '', isActive: false });
  });
});
