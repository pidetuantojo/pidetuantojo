import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

import { CheckoutError, checkoutSchema } from '@/lib/orders/checkout.schema';

import { FakeFirestore, increment } from './fakeFirestore';

const db = new FakeFirestore();

vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { increment } }));

// Se importa después de los mocks (usa adminDb al ejecutarse)
let createPublicOrder: typeof import('@/lib/orders/createOrder.server').createPublicOrder;
beforeAll(async () => {
  ({ createPublicOrder } = await import('@/lib/orders/createOrder.server'));
});

// Miércoles 14 de octubre de 2026, 16:00 en Colombia
const NOW = new Date('2026-10-14T21:00:00Z');
const R = 'restaurants/r1';

function seed() {
  db.docs.clear();
  db.set(R, {
    id: 'r1', slug: 'r1', name: 'Antojo', isActive: true, phone: '573001234567', deliveryMode: 'zones',
    paymentMethods: [{ id: 'efectivo', type: 'efectivo', isActive: true }, { id: 'n1', type: 'nequi', isActive: false }],
    loyalty: { isActive: true, ordersRequired: 2, rewardKind: 'amount', rewardValue: 10000 },
  });
  db.set(`${R}/orderStatuses/st-received`, { code: 'received', sortOrder: 1 });
  db.set(`${R}/orderStatuses/st-delivered`, { code: 'delivered', sortOrder: 5 });
  db.set(`${R}/products/burger`, { restaurantId: 'r1', categoryId: 'burgers', name: 'Hamburguesa', price: 20000, adicionalIds: ['queso'], isActive: true, isAvailable: true });
  db.set(`${R}/products/soda`, { restaurantId: 'r1', categoryId: 'drinks', name: 'Gaseosa', price: 5000, adicionalIds: [], isActive: true, isAvailable: true });
  db.set(`${R}/products/agotado`, { restaurantId: 'r1', categoryId: 'burgers', name: 'Especial', price: 30000, adicionalIds: [], isActive: true, isAvailable: false });
  db.set(`${R}/adicionales/queso`, { name: 'Extra queso', price: 3000, isActive: true });
  db.set(`${R}/deliveryZones/centro`, { name: 'Centro', price: 6000, isActive: true });
}

function promo(id: string, data: Record<string, unknown>) {
  db.set(`${R}/promotions/${id}`, { id, restaurantId: 'r1', name: id, showInMenu: true, isActive: true, usesCount: 0, createdAt: '', updatedAt: '', ...data });
}

function input(overrides: Record<string, unknown> = {}) {
  return checkoutSchema.parse({
    restaurantId: 'r1',
    items: [{ productId: 'burger', quantity: 2 }],
    customerName: 'Juan',
    customerPhone: '300 123 4567',
    deliveryType: 'recoger',
    paymentMethodId: 'efectivo',
    ...overrides,
  });
}

describe('createPublicOrder', () => {
  beforeEach(seed);

  it('los precios salen de la base de datos, no del navegador', async () => {
    const order = await createPublicOrder(input({ items: [{ productId: 'burger', quantity: 2, additionalIds: ['queso'] }] }), NOW);
    expect(order.subtotal).toBe(46000);
    expect(order.total).toBe(46000);
    expect(order.items[0]).toMatchObject({ unitPrice: 20000, additionals: [{ id: 'queso', name: 'Extra queso', price: 3000 }] });
    const saved = db.get(`${R}/orders/${order.id}`)!;
    expect(saved).toMatchObject({ statusId: 'st-received', customerPhoneKey: '3001234567', paymentMethod: 'Efectivo', isPaid: false });
  });

  it('aplica promociones, cuenta el uso y registra al cliente', async () => {
    promo('p20', { type: 'item_discount', discountKind: 'percent', discountValue: 20, target: { scope: 'categories', categoryIds: ['burgers'] } });
    const order = await createPublicOrder(input({ marketingOptIn: true }), NOW);
    expect(order.discount).toBe(8000);
    expect(order.total).toBe(32000);
    expect(order.items[0]).toMatchObject({ discount: 8000, promotionName: 'p20' });
    expect(db.get(`${R}/promotions/p20`)!.usesCount).toBe(1);
    expect(db.get(`${R}/customers/3001234567`)).toMatchObject({ ordersCount: 1, promoUses: { p20: 1 }, marketingOptIn: true });
  });

  it('zona de domicilio desde la base y domicilio gratis por promoción', async () => {
    const order = await createPublicOrder(input({ deliveryType: 'domicilio', customerAddress: 'Calle 1', deliveryZoneId: 'centro' }), NOW);
    expect(order).toMatchObject({ deliveryFee: 6000, total: 46000, deliveryZoneName: 'Centro' });

    promo('envio', { type: 'free_delivery', minSubtotal: 30000 });
    const free = await createPublicOrder(input({ deliveryType: 'domicilio', customerAddress: 'Calle 1', deliveryZoneId: 'centro' }), NOW);
    expect(free).toMatchObject({ deliveryFee: 0, freeDelivery: true, total: 40000 });
  });

  it('rechaza productos agotados, adicionales no permitidos y pagos inactivos', async () => {
    await expect(createPublicOrder(input({ items: [{ productId: 'agotado', quantity: 1 }] }), NOW)).rejects.toThrow(/agotado/);
    await expect(createPublicOrder(input({ items: [{ productId: 'soda', quantity: 1, additionalIds: ['queso'] }] }), NOW)).rejects.toBeInstanceOf(CheckoutError);
    await expect(createPublicOrder(input({ paymentMethodId: 'n1' }), NOW)).rejects.toThrow(/método de pago/);
    await expect(createPublicOrder(input({ deliveryType: 'domicilio', customerAddress: 'Calle 1', deliveryZoneId: 'no-existe' }), NOW)).rejects.toThrow(/zona/);
  });

  it('cupón inválido o con condiciones no cumplidas: no crea el pedido', async () => {
    promo('cupon', { type: 'order_discount', discountKind: 'percent', discountValue: 10, stackable: true, couponCode: 'INSTA10', minSubtotal: 100000 });
    await expect(createPublicOrder(input({ couponCode: 'NOEXISTE' }), NOW)).rejects.toThrow(/no existe/);
    await expect(createPublicOrder(input({ couponCode: 'insta10' }), NOW)).rejects.toThrow(/Pedido mínimo/);
    expect(Array.from(db.docs.keys()).some((k) => k.includes('/orders/'))).toBe(false);
  });

  it('límite total de usos: la última unidad no se vende dos veces', async () => {
    promo('ultimas', { type: 'order_discount', discountKind: 'amount', discountValue: 5000, stackable: true, maxUses: 1 });
    const first = await createPublicOrder(input(), NOW);
    expect(first.discount).toBe(5000);
    // Ya agotada: el segundo pedido se crea sin el descuento
    const second = await createPublicOrder(input({ customerPhone: '3110000000' }), NOW);
    expect(second.discount).toBe(0);
  });

  it('primer pedido: solo el primero con ese celular', async () => {
    promo('bienvenida', { type: 'order_discount', discountKind: 'percent', discountValue: 10, stackable: true, firstOrderOnly: true });
    expect((await createPublicOrder(input(), NOW)).discount).toBe(4000);
    expect((await createPublicOrder(input({ customerPhone: '+57 300 123 4567' }), NOW)).discount).toBe(0);
  });

  it('fidelidad: solo cuentan pedidos entregados o pagados y el canje reinicia los sellos', async () => {
    const a = await createPublicOrder(input(), NOW);
    const b = await createPublicOrder(input(), NOW);
    await expect(createPublicOrder(input({ redeemLoyalty: true }), NOW)).rejects.toThrow(/fidelidad/);

    db.update(`${R}/orders/${a.id}`, { statusId: 'st-delivered' });
    db.update(`${R}/orders/${b.id}`, { isPaid: true });
    const later = new Date(NOW.getTime() + 60_000);
    const redeemed = await createPublicOrder(input({ redeemLoyalty: true }), later);
    expect(redeemed.discount).toBe(10000);
    expect(redeemed.appliedPromotions).toEqual([expect.objectContaining({ type: 'loyalty', amount: 10000 })]);
    expect(db.get(`${R}/customers/3001234567`)).toMatchObject({ loyaltyRedeemedAt: later.toISOString(), loyaltyRedemptions: 1 });

    // Después del canje se empieza de cero
    await expect(createPublicOrder(input({ redeemLoyalty: true }), new Date(later.getTime() + 60_000))).rejects.toThrow(/fidelidad/);
  });

  it('restaurante inactivo: no recibe pedidos', async () => {
    db.update(R, { isActive: false });
    await expect(createPublicOrder(input(), NOW)).rejects.toThrow(/no está recibiendo pedidos/);
  });
});
