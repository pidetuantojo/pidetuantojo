import { describe, it, expect } from 'vitest';

import { getBoardColumn, getOccupiedTables, isOrderFinished } from '@/features/orders/helpers/board.helpers';
import { applyManualDiscount, percentToAmount, recalcAmounts } from '@/features/orders/helpers/amounts.helpers';
import {
  buildPaymentMessage, isFullyPaid, paymentsByMethod, remainingAmount, splitEvenly,
} from '@/features/orders/helpers/payments.helpers';
import { calculateStats } from '@/features/accounting/helpers/accounting.helpers';
import type { Order, OrderItem, OrderPayment } from '@/types';

const statuses = [
  { id: 's1', code: 'received' },
  { id: 's4', code: 'ready' },
  { id: 's5', code: 'delivered' },
  { id: 's6', code: 'cancelled' },
];

function item(over: Partial<OrderItem> = {}): OrderItem {
  return { productId: 'p', productName: 'Hamburguesa', quantity: 1, unitPrice: 10000, subtotal: 10000, additionals: [], ...over };
}

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'o1', restaurantId: 'r', orderNumber: '0001', customerName: 'Kevin', customerPhone: '3001234567',
    paymentMethod: 'Efectivo', items: [item()], subtotal: 10000, total: 10000, statusId: 's1',
    createdAt: '2026-10-06T12:00:00.000Z', updatedAt: '2026-10-06T12:00:00.000Z', ...over,
  };
}

function pay(amount: number, method = 'Efectivo'): OrderPayment {
  return { id: `p${amount}${method}`, amount, method, paidAt: '2026-10-06T12:00:00.000Z' };
}

describe('tablero por tipo de pedido', () => {
  it('sin tipo de entrega se trata como para llevar', () => {
    expect(getBoardColumn({})).toBe('recoger');
    expect(getBoardColumn({ deliveryType: 'mesa' })).toBe('mesa');
  });

  it('para llevar / domicilio salen del tablero al entregarse; cancelado siempre', () => {
    expect(isOrderFinished(order({ statusId: 's4' }), statuses)).toBe(false);
    expect(isOrderFinished(order({ statusId: 's5' }), statuses)).toBe(true);
    expect(isOrderFinished(order({ statusId: 's6', deliveryType: 'mesa' }), statuses)).toBe(true);
  });

  it('mesa: entregada sigue en el tablero hasta liberar la mesa', () => {
    const mesa = order({ deliveryType: 'mesa', tableId: 't4', statusId: 's5' });
    expect(isOrderFinished(mesa, statuses)).toBe(false);
    expect(isOrderFinished({ ...mesa, tableReleasedAt: '2026-10-06T13:00:00.000Z' }, statuses)).toBe(true);
  });

  it('mesas ocupadas: solo pedidos de mesa activos', () => {
    const occupied = getOccupiedTables([
      order({ id: 'a', deliveryType: 'mesa', tableId: 't1' }),
      order({ id: 'b', deliveryType: 'mesa', tableId: 't2', tableReleasedAt: '2026-10-06T13:00:00.000Z' }),
      order({ id: 'c', deliveryType: 'recoger', tableId: 't3' }),
    ], statuses);
    expect(Array.from(occupied.keys())).toEqual(['t1']);
  });
});

describe('montos', () => {
  it('quitar un producto conserva descuentos al total y los de las líneas que quedan', () => {
    const items = [item({ subtotal: 20000, discount: 5000 }), item({ subtotal: 10000 })];
    // discount 8000 = 5000 de línea + 3000 al total (promo o manual)
    const o = order({ items, subtotal: 30000, discount: 8000, deliveryFee: 4000 });
    expect(recalcAmounts(o, [items[1]])).toEqual({ subtotal: 10000, discount: 3000, total: 11000 });
    expect(recalcAmounts(o, [items[0]])).toEqual({ subtotal: 20000, discount: 8000, total: 16000 });
  });

  it('el descuento manual se suma a las promociones y reemplaza al manual anterior', () => {
    const o = order({ subtotal: 50000, discount: 7000, manualDiscount: 2000, deliveryFee: 5000 });
    expect(applyManualDiscount(o, 10000)).toEqual({ subtotal: 50000, discount: 15000, manualDiscount: 10000, total: 40000 });
    // Quitarlo deja solo las promociones
    expect(applyManualDiscount(o, 0)).toMatchObject({ discount: 5000, manualDiscount: 0, total: 50000 });
  });

  it('el descuento manual nunca deja los productos en negativo', () => {
    const o = order({ subtotal: 10000, discount: 4000 });
    expect(applyManualDiscount(o, 99999)).toMatchObject({ manualDiscount: 6000, discount: 10000, total: 0 });
  });

  it('porcentaje sobre los productos después de promociones', () => {
    expect(percentToAmount(order({ subtotal: 50000, discount: 10000 }), 10)).toBe(4000);
  });
});

describe('pagos', () => {
  it('divide en partes iguales en pesos enteros sin perder pesos', () => {
    expect(splitEvenly(95000, 3)).toEqual([31667, 31667, 31666]);
    expect(splitEvenly(95000, 3).reduce((a, b) => a + b)).toBe(95000);
    expect(splitEvenly(1000, 0)).toEqual([1000]);
  });

  it('pendiente y pagado según los pagos registrados', () => {
    const o = order({ subtotal: 95000, total: 95000, payments: [pay(40000)] });
    expect(remainingAmount(o)).toBe(55000);
    expect(isFullyPaid(o)).toBe(false);
    expect(isFullyPaid({ ...o, payments: [pay(40000), pay(55000, 'Nequi')] })).toBe(true);
  });

  it('contabilidad: una cuenta dividida suma en cada método', () => {
    const split = order({ subtotal: 95000, total: 95000, payments: [pay(40000), pay(55000, 'Nequi')] });
    const partial = order({ id: 'o2', subtotal: 30000, total: 30000, paymentMethod: 'Nequi', payments: [pay(10000)] });
    expect(paymentsByMethod(split)).toEqual([{ method: 'Efectivo', amount: 40000 }, { method: 'Nequi', amount: 55000 }]);
    // Lo no pagado se atribuye al método elegido por el cliente
    expect(paymentsByMethod(partial)).toEqual([{ method: 'Efectivo', amount: 10000 }, { method: 'Nequi', amount: 20000 }]);
    const stats = calculateStats([split, partial, order({ id: 'o3' })]);
    expect(stats.byPaymentMethod).toEqual({
      Efectivo: { total: 60000, count: 3 },
      Nequi: { total: 75000, count: 2 },
    });
    expect(stats.totalRevenue).toBe(135000);
  });

  it('mensaje de pago: pendiente con cuenta, o confirmación si ya pagó', () => {
    const pending = order({ subtotal: 33000, total: 33000, paymentMethod: 'Nequi', paymentAccount: '3001112233' });
    expect(buildPaymentMessage(pending)).toContain('$33.000');
    expect(buildPaymentMessage(pending)).toContain('3001112233');
    expect(buildPaymentMessage({ ...pending, isPaid: true })).toContain('Confirmamos el pago');
  });
});
