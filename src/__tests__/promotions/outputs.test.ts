// Promociones en lo que ve la gente: WhatsApp, ticket impreso y contabilidad.
import { describe, it, expect } from 'vitest';

import { calculateStats } from '@/features/accounting/helpers/accounting.helpers';
import { buildWhatsAppMessage } from '@/features/menu/helpers/whatsapp.helpers';
import { buildOrderTicket } from '@/lib/printer/ticketBuilder';
import type { Order } from '@/types';

const ORDER: Order = {
  id: 'o1', restaurantId: 'r1', orderNumber: '#100200',
  customerName: 'Ana', customerPhone: '3001234567',
  customerAddress: 'Calle 1', barrio: 'Centro',
  deliveryType: 'domicilio', deliveryFee: 0, freeDelivery: true,
  paymentMethod: 'Efectivo', isPaid: false,
  items: [
    { productId: 'b', productName: 'Hamburguesa', quantity: 2, unitPrice: 20000, subtotal: 40000, additionals: [], discount: 20000, promotionName: '2x1 martes' },
    { productId: 's', productName: 'Gaseosa', quantity: 1, unitPrice: 0, subtotal: 0, additionals: [], isGift: true, promotionName: 'Regalo' },
  ],
  subtotal: 40000, discount: 22000, total: 18000,
  appliedPromotions: [
    { promotionId: 'p1', name: '2x1 martes', type: 'bundle', amount: 20000 },
    { promotionId: 'p2', name: 'Cupón Insta', type: 'order_discount', amount: 2000, couponCode: 'INSTA10' },
    { promotionId: 'p3', name: 'Envío gratis', type: 'free_delivery', amount: 6000 },
    { promotionId: 'p4', name: 'Regalo', type: 'gift', amount: 0, detail: 'Regalo: Gaseosa' },
  ],
  couponCode: 'INSTA10',
  statusId: 's1', createdAt: '2026-10-14T21:00:00.000Z', updatedAt: '2026-10-14T21:00:00.000Z',
};

describe('WhatsApp con promociones', () => {
  const message = buildWhatsAppMessage('Antojo', ORDER.items, {
    orderNumber: ORDER.orderNumber, customerName: 'Ana', customerPhone: '3001234567', deliveryType: 'domicilio',
    address: 'Calle 1', paymentLabel: 'Efectivo', subtotal: 40000, discount: 22000,
    promotions: ORDER.appliedPromotions, deliveryFee: 0, freeDelivery: true,
  });

  it('muestra descuentos por línea, regalo, cupón, domicilio gratis y total', () => {
    expect(message).toContain('🏷 _2x1 martes: −$20.000_');
    expect(message).toContain('🎁 1 x Gaseosa (*Regalo*');
    expect(message).toContain('Cupón Insta (cupón INSTA10): −$2.000');
    expect(message).toContain('Descuentos: −$22.000');
    expect(message).toContain('*GRATIS*');
    expect(message).toContain('💰 *Total del pedido: $18.000*');
  });
});

describe('Ticket con promociones', () => {
  const text = buildOrderTicket(ORDER, { paperWidth: 80, encoding: 'ascii' }, { restaurantName: 'Antojo' });

  it('imprime descuentos, regalo, domicilio gratis y cupón', () => {
    expect(text).toContain('REGALO');
    expect(text).toContain('Promo: 2x1 martes');
    expect(text).toContain('Cupon Insta');
    expect(text).toContain('GRATIS');
    expect(text).toContain('$18.000');
    expect(text).toContain('Cupon: INSTA10');
    expect(text).not.toContain('Valor de domicilio pendiente');
  });
});

describe('Contabilidad con promociones', () => {
  it('ventas brutas, descuentos, netas y ranking de promociones', () => {
    const plain: Order = { ...ORDER, id: 'o2', items: [ORDER.items[0]], discount: undefined, appliedPromotions: undefined, total: 40000, freeDelivery: undefined };
    const stats = calculateStats([ORDER, plain]);
    expect(stats).toMatchObject({ grossSales: 80000, discounts: 22000, netSales: 58000, totalRevenue: 58000 });
    expect(stats.byPromotion.find((p) => p.promotionId === 'p3')).toMatchObject({ orders: 1, cost: 6000, revenue: 18000 });
    // Los regalos no cuentan como unidades vendidas
    expect(stats.byProduct).toEqual([{ name: 'Hamburguesa', units: 4 }]);
  });
});
