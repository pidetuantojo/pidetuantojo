import { describe, it, expect } from 'vitest';

import { buildOrderTimeline, deliveryLabel, formatDuration } from '@/features/accounting/helpers/orderDetail.helpers';
import { statusChange } from '@/lib/orders/statusHistory';
import type { Order, OrderStatus } from '@/types';

const statuses = [
  { id: 's1', code: 'received', name: 'Recibido', color: '#000' },
  { id: 's3', code: 'preparing', name: 'Preparando', color: '#111' },
  { id: 's5', code: 'delivered', name: 'Entregado', color: '#222' },
] as OrderStatus[];

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'o1', restaurantId: 'r', orderNumber: '0001', customerName: 'Kevin', customerPhone: '3001234567',
    paymentMethod: 'Efectivo', items: [], subtotal: 10000, total: 10000, statusId: 's1',
    createdAt: '2026-10-06T12:00:00.000Z', updatedAt: '2026-10-06T12:00:00.000Z', ...over,
  };
}

describe('deliveryLabel', () => {
  it('nombra el tipo de entrega y la mesa sin repetir "Mesa"', () => {
    expect(deliveryLabel(order({ deliveryType: 'domicilio' }))).toBe('Domicilio');
    expect(deliveryLabel(order({ deliveryType: 'mesa', tableName: 'Mesa 4' }))).toBe('Mesa 4');
    expect(deliveryLabel(order({ deliveryType: 'mesa', tableName: 'Terraza' }))).toBe('Mesa Terraza');
    expect(deliveryLabel(order())).toBe('Recoger');
  });
});

describe('buildOrderTimeline', () => {
  it('pedido viejo sin historial: solo la creación y sin tiempo de entrega', () => {
    const t = buildOrderTimeline(order({ statusId: 's5' }), statuses);
    expect(t.hasHistory).toBe(false);
    expect(t.entries).toHaveLength(1);
    expect(t.fulfillmentMs).toBeUndefined();
  });

  it('ordena los cambios y mide hasta el último "Entregado"', () => {
    const t = buildOrderTimeline(order({
      statusHistory: [
        statusChange('s5', { uid: 'u', name: 'Ana' }, '2026-10-06T12:50:00.000Z'),
        statusChange('s1', null, '2026-10-06T12:00:00.000Z'),
        statusChange('s5', null, '2026-10-06T12:30:00.000Z'),
        statusChange('s3', null, '2026-10-06T12:40:00.000Z'),
      ],
    }), statuses);
    expect(t.entries.map((e) => e.label)).toEqual(['Pedido creado · Recibido', 'Estado: Entregado', 'Estado: Preparando', 'Estado: Entregado']);
    expect(t.entries[3].byName).toBe('Ana');
    expect(t.deliveredAt).toBe('2026-10-06T12:50:00.000Z');
    expect(t.fulfillmentMs).toBe(50 * 60000);
  });

  it('incluye la liberación de la mesa en su lugar cronológico', () => {
    const t = buildOrderTimeline(order({ tableReleasedAt: '2026-10-06T13:00:00.000Z' }), statuses);
    expect(t.entries.map((e) => e.key)).toEqual(['created', 'released']);
  });
});

describe('statusChange', () => {
  it('no escribe campos undefined (Firestore los rechaza)', () => {
    expect(statusChange('s1', null, 'x')).toEqual({ statusId: 's1', at: 'x' });
    expect(statusChange('s1', { uid: 'u' }, 'x')).toEqual({ statusId: 's1', at: 'x', by: 'u' });
  });
});

describe('formatDuration', () => {
  it('minutos, horas y días', () => {
    expect(formatDuration(42 * 60000)).toBe('42 min');
    expect(formatDuration(65 * 60000)).toBe('1 h 05 min');
    expect(formatDuration(51 * 3600000)).toBe('2 d 3 h');
  });
});
