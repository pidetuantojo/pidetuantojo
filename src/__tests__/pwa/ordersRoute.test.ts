// El aviso push nunca debe frenar ni romper el checkout.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const createPublicOrder = vi.fn();
const notifyNewOrder = vi.fn();

vi.mock('@/lib/orders/createOrder.server', () => ({ createPublicOrder }));
vi.mock('@/lib/push/push.server', async () => {
  const withTimeout = async <T,>(task: Promise<T>, ms: number) =>
    Promise.race([task, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms))]);
  return { notifyNewOrder, withTimeout };
});

let POST: typeof import('@/app/api/orders/route').POST;
beforeAll(async () => {
  ({ POST } = await import('@/app/api/orders/route'));
});

const body = {
  restaurantId: 'r1',
  items: [{ productId: 'p1', quantity: 1 }],
  customerName: 'Juan',
  customerPhone: '3001234567',
  deliveryType: 'domicilio',
  customerAddress: 'Calle 1',
  paymentMethodId: 'efectivo',
};
const request = () => new Request('http://localhost/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const created = { id: 'o1', orderNumber: '#100', total: 30000, items: [] };

describe('POST /api/orders + aviso push', () => {
  beforeEach(() => {
    createPublicOrder.mockReset().mockResolvedValue(created);
    notifyNewOrder.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('avisa al restaurante con los datos del pedido', async () => {
    notifyNewOrder.mockResolvedValue({ sent: 2, failed: 0, removed: 0 });
    const res = await POST(request());
    expect(res.status).toBe(201);
    expect(notifyNewOrder).toHaveBeenCalledWith('r1', expect.objectContaining({ id: 'o1', orderNumber: '#100', customerName: 'Juan', total: 30000, deliveryType: 'domicilio' }));
  });

  it('si el push falla, el pedido igual responde 201', async () => {
    notifyNewOrder.mockRejectedValue(new Error('FCM caído'));
    const res = await POST(request());
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: 'o1' });
  });

  it('si el pedido falla, no se avisa', async () => {
    createPublicOrder.mockRejectedValue(new Error('boom'));
    const res = await POST(request());
    expect(res.status).toBe(500);
    expect(notifyNewOrder).not.toHaveBeenCalled();
  });
});
