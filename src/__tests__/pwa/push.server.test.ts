import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

const db = new FakeFirestore();
const sendEach = vi.fn();

vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {}, adminMessaging: { sendEach } }));

let push: typeof import('@/lib/push/push.server');
beforeAll(async () => {
  push = await import('@/lib/push/push.server');
});

const user = (uid: string, data: Record<string, unknown>) => db.set(`users/${uid}`, { isActive: true, restaurantId: 'r1', ...data });

async function seedTokens() {
  user('admin', { role: 'restaurant_admin' }); // sin effectivePermissions: todo (legacy)
  user('cajero', { role: 'restaurant_employee', effectivePermissions: ['orders.view'] });
  user('bodega', { role: 'restaurant_employee', effectivePermissions: ['products.view'] });
  user('inactivo', { role: 'restaurant_employee', effectivePermissions: ['orders.view'], isActive: false });
  user('otro', { role: 'restaurant_admin', restaurantId: 'r2' });
  for (const uid of ['admin', 'cajero', 'bodega', 'inactivo']) {
    await push.registerPushToken({ uid, restaurantId: 'r1', token: `token-${uid}-${'x'.repeat(20)}` });
  }
  // Token de un usuario que se cambió de restaurante: sigue guardado con r1, pero su usuario ya es de r2
  await push.registerPushToken({ uid: 'otro', restaurantId: 'r1', token: `token-otro-${'x'.repeat(20)}` });
}

describe('push.server', () => {
  beforeEach(() => {
    db.docs.clear();
    sendEach.mockReset();
  });

  it('solo avisa a usuarios activos de ese restaurante con orders.view', async () => {
    await seedTokens();
    const tokens = (await push.recipientTokens('r1')).map((t) => t.token).sort();
    expect(tokens).toEqual([`token-admin-${'x'.repeat(20)}`, `token-cajero-${'x'.repeat(20)}`]);
  });

  it('envía datos (sin notification) con prioridad alta y borra los tokens vencidos', async () => {
    await seedTokens();
    sendEach.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [{ success: true }, { success: false, error: { code: 'messaging/registration-token-not-registered' } }],
    });

    const result = await push.notifyNewOrder('r1', { id: 'o1', orderNumber: '#100', customerName: 'Ana', total: 30000, deliveryType: 'recoger' });

    expect(result).toEqual({ sent: 1, failed: 1, removed: 1 });
    const messages = sendEach.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ data: { kind: 'new_order', url: '/dashboard/pedidos?pedido=o1' }, android: { priority: 'high' } });
    expect(messages[0]).not.toHaveProperty('notification');
    // El segundo token falló como "no registrado": se borró
    expect(await push.recipientTokens('r1')).toHaveLength(1);
  });

  it('sin dispositivos no llama a FCM', async () => {
    expect(await push.notifyNewOrder('r1', { id: 'o1', orderNumber: '#1', customerName: 'A', total: 1 })).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(sendEach).not.toHaveBeenCalled();
  });

  it('un usuario solo puede borrar sus propios tokens', async () => {
    const token = `token-cajero-${'x'.repeat(20)}`;
    user('cajero', { role: 'restaurant_employee', effectivePermissions: ['orders.view'] });
    await push.registerPushToken({ uid: 'cajero', restaurantId: 'r1', token });
    await push.unregisterPushToken('otro', token);
    expect(await push.userTokens('cajero')).toHaveLength(1);
    await push.unregisterPushToken('cajero', token);
    expect(await push.userTokens('cajero')).toHaveLength(0);
  });

  it('withTimeout corta lo que tarda demasiado', async () => {
    expect(await push.withTimeout(new Promise((r) => setTimeout(() => r('ok'), 50)), 5)).toBe('timeout');
    expect(await push.withTimeout(Promise.resolve('ok'), 50)).toBe('ok');
  });
});
