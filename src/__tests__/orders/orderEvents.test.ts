import { describe, it, expect } from 'vitest';

import { buildOrderTimeline } from '@/features/accounting/helpers/orderDetail.helpers';
import { diffItems, orderEvents, type OrderEvent } from '@/lib/orders/orderEvents';
import type { Order, OrderItem, OrderStatus } from '@/types';

function item(over: Partial<OrderItem> = {}): OrderItem {
  return { productId: 'p', productName: 'Hamburguesa', quantity: 1, unitPrice: 20000, subtotal: 20000, additionals: [], ...over };
}

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'o1', restaurantId: 'r', orderNumber: '1042', customerName: 'Ana', customerPhone: '3001234567',
    paymentMethod: 'Efectivo', items: [item()], subtotal: 20000, total: 20000, statusId: 's1',
    createdAt: '2026-10-31T12:00:00.000Z', updatedAt: '2026-10-31T12:00:00.000Z', ...over,
  };
}

describe('diffItems', () => {
  it('muestra lo que se agregó y lo que se quitó, con adicionales', () => {
    const before = [item({ quantity: 2 }), item({ productName: 'Gaseosa' })];
    const after = [item({ quantity: 1 }), item({ productName: 'Papas', additionals: [{ name: 'Queso', price: 2000 }] })];
    expect(diffItems(before, after)).toBe('+1× Papas + Queso · −1× Hamburguesa · −1× Gaseosa');
    expect(diffItems(before, before)).toBe('');
  });
});

describe('orderEvents.edited', () => {
  it('registra el antes y el después solo de lo que cambió', () => {
    const ev = orderEvents.edited(order(), { customerName: 'Ana María', customerPhone: '3001234567', total: 26000, items: [item(), item({ productName: 'Papas' })] });
    expect(ev?.changes).toEqual([
      { label: 'Cliente', before: 'Ana', after: 'Ana María' },
      { label: 'Productos', before: '', after: '+1× Papas' },
      { label: 'Total', before: '$20.000', after: '$26.000' },
    ]);
    expect(ev?.sensitive).toBe(false);
  });

  it('sin cambios no genera evento; bajar el total se marca para revisar', () => {
    expect(orderEvents.edited(order(), { customerName: 'Ana' })).toBeNull();
    expect(orderEvents.edited(order(), { total: 15000 })?.sensitive).toBe(true);
  });
});

describe('eventos sensibles', () => {
  it('anular pagos, descuentos, marcar pendiente y eliminar se marcan para revisar', () => {
    expect(orderEvents.paymentRemoved({ id: 'x', method: 'Nequi', amount: 25000, paidAt: '' })).toMatchObject({ summary: 'Anuló un pago: Nequi $25.000', sensitive: true });
    expect(orderEvents.discount(undefined, 5000, 'Cliente frecuente', 20000, 15000)).toMatchObject({ summary: 'Descuento manual de $5.000 (Cliente frecuente)', sensitive: true });
    expect(orderEvents.paidFlag(false).sensitive).toBe(true);
    expect(orderEvents.paidFlag(true).sensitive).toBeUndefined();
    expect(orderEvents.deleted('Duplicado').sensitive).toBe(true);
  });
});

describe('buildOrderTimeline con auditoría', () => {
  const statuses = [{ id: 's1', code: 'received', name: 'Recibido', color: '#000' }] as OrderStatus[];
  const ev = (over: Partial<OrderEvent>): OrderEvent => ({ id: 'e', type: 'created', summary: '', at: '', ...over });

  it('une estados y eventos en orden, con quién lo hizo o "Sistema"', () => {
    const t = buildOrderTimeline(
      order({ statusHistory: [{ statusId: 's1', at: '2026-10-31T12:00:00.000Z' }] }),
      statuses,
      [
        ev({ id: 'e2', type: 'payment_removed', summary: 'Anuló un pago', at: '2026-10-31T12:30:00.000Z', by: 'u1', byName: 'Carlos', sensitive: true }),
        ev({ id: 'e1', type: 'created', summary: 'Pedido creado desde la carta', at: '2026-10-31T12:00:00.000Z' }),
      ],
    );
    expect(t.entries.map((e) => e.label)).toEqual(['Estado: Recibido', 'Pedido creado desde la carta', 'Anuló un pago']);
    expect(t.entries[1].system).toBe(true);
    expect(t.entries[2]).toMatchObject({ byName: 'Carlos', sensitive: true });
  });

  it('pedido viejo: muestra los pagos guardados; con auditoría no los duplica', () => {
    const paid = order({ payments: [{ id: 'p1', method: 'Nequi', amount: 20000, paidAt: '2026-10-31T13:00:00.000Z' }] });
    expect(buildOrderTimeline(paid, statuses).entries.map((e) => e.label)).toContain('Registró un pago: Nequi $20.000');

    const withEvent = buildOrderTimeline(paid, statuses, [ev({ id: 'e1', type: 'payment_added', summary: 'Registró un pago: Nequi $20.000', at: '2026-10-31T13:00:00.000Z', by: 'u1' })]);
    expect(withEvent.entries.filter((e) => e.label.startsWith('Registró un pago'))).toHaveLength(1);
  });
});
