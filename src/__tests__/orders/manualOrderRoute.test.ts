// POST /api/orders/manual: solo con sesión y permiso de crear pedidos en ese restaurante.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

import { FakeFirestore } from './fakeFirestore';

const db = new FakeFirestore();
const verifyIdToken = vi.fn();
const createPanelOrder = vi.fn();

vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: { verifyIdToken } }));
vi.mock('@/lib/orders/createOrder.server', () => ({ createPanelOrder }));

let POST: typeof import('@/app/api/orders/manual/route').POST;
beforeAll(async () => {
  ({ POST } = await import('@/app/api/orders/manual/route'));
});

const body = { restaurantId: 'r1', items: [{ productId: 'burger', quantity: 1 }], customerName: 'Juan', customerPhone: '3001234567', deliveryType: 'recoger', paymentMethodId: 'efectivo' };
function call(uid?: string) {
  return POST(new Request('http://localhost/api/orders/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer token-${uid}` } : {}) },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/orders/manual', () => {
  beforeEach(() => {
    db.docs.clear();
    db.set('users/cajero', { role: 'restaurant_employee', isActive: true, restaurantId: 'r1', displayName: 'Ana', effectivePermissions: ['orders.view', 'orders.create'] });
    db.set('users/cocina', { role: 'restaurant_employee', isActive: true, restaurantId: 'r1', effectivePermissions: ['orders.view'] });
    db.set('users/otro', { role: 'restaurant_admin', isActive: true, restaurantId: 'r2', effectivePermissions: ['orders.create'] });
    verifyIdToken.mockReset().mockImplementation(async (t: string) => ({ uid: t.replace('token-', '') }));
    createPanelOrder.mockReset().mockResolvedValue({ id: 'o1', orderNumber: '1', total: 20000 });
  });

  it('sin sesión 401; sin permiso u otro restaurante 403', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('cocina')).status).toBe(403);
    expect((await call('otro')).status).toBe(403);
    expect(createPanelOrder).not.toHaveBeenCalled();
  });

  it('con permiso crea el pedido firmado por quien lo hizo', async () => {
    const res = await call('cajero');
    expect(res.status).toBe(201);
    expect(createPanelOrder).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: 'r1' }), { uid: 'cajero', name: 'Ana' });
  });
});
