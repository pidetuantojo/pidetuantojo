import { describe, it, expect } from 'vitest';

import { getOrderTotals } from '@/features/orders/helpers/totals.helpers';

describe('getOrderTotals', () => {
  it('total productos = subtotal; total = productos + domicilio (sin sumar el domicilio dos veces)', () => {
    // Caso de la captura: productos $36.000 + domicilio $15.000; `total` guardado ya incluía el domicilio
    expect(getOrderTotals({ subtotal: 36000, deliveryFee: 15000 })).toEqual({
      productsTotal: 36000,
      discount: 0,
      deliveryFee: 15000,
      total: 51000,
    });
  });

  it('sin domicilio → el total es el de productos', () => {
    expect(getOrderTotals({ subtotal: 20000 })).toEqual({ productsTotal: 20000, discount: 0, deliveryFee: 0, total: 20000 });
  });

  it('con promociones: total = productos − descuentos + domicilio', () => {
    expect(getOrderTotals({ subtotal: 40000, discount: 8000, deliveryFee: 5000 })).toEqual({
      productsTotal: 40000, discount: 8000, deliveryFee: 5000, total: 37000,
    });
  });

  it('el descuento nunca deja los productos en negativo', () => {
    expect(getOrderTotals({ subtotal: 10000, discount: 15000, deliveryFee: 3000 }).total).toBe(3000);
  });
});
