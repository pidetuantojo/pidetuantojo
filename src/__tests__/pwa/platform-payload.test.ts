import { describe, it, expect } from 'vitest';

import { detectPlatform, getPushSupport, type PushEnvironment } from '@/lib/pwa/platform';
import { buildNewOrderPush, buildTestPush, isInvalidTokenError, toFcmData } from '@/lib/push/payload';

describe('detectPlatform', () => {
  it('reconoce iPhone, iPad (que se presenta como Mac), Android y PC', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('desktop');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; SM-A145M)')).toBe('android');
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });
});

describe('getPushSupport', () => {
  const env = (overrides: Partial<PushEnvironment> = {}): PushEnvironment => ({
    platform: 'android', isStandalone: false, hasServiceWorker: true, hasPushManager: true, hasNotification: true, isConfigured: true, ...overrides,
  });

  it('listo en Android/PC con navegador compatible', () => {
    expect(getPushSupport(env())).toBe('ready');
    expect(getPushSupport(env({ platform: 'desktop' }))).toBe('ready');
  });
  it('iPhone: primero hay que instalar la app', () => {
    expect(getPushSupport(env({ platform: 'ios' }))).toBe('ios_install');
    expect(getPushSupport(env({ platform: 'ios', isStandalone: true }))).toBe('ready');
  });
  it('sin push o sin clave VAPID', () => {
    expect(getPushSupport(env({ hasPushManager: false }))).toBe('unsupported');
    expect(getPushSupport(env({ isConfigured: false }))).toBe('not_configured');
  });
});

describe('avisos push', () => {
  it('pedido nuevo: título, resumen y enlace al pedido', () => {
    const push = buildNewOrderPush({ id: 'abc', orderNumber: '#123456', customerName: ' Juan ', total: 45000, deliveryType: 'domicilio' });
    expect(push).toEqual({
      kind: 'new_order',
      title: '🛎 Nuevo pedido #123456',
      body: 'Juan · $45.000 · Domicilio',
      url: '/dashboard/pedidos?pedido=abc',
      tag: 'order-abc',
      orderId: 'abc',
    });
  });

  it('mesa y programado', () => {
    const push = buildNewOrderPush({ id: 'x', orderNumber: '#1', customerName: 'Ana', total: 20000, deliveryType: 'mesa', tableName: 'Mesa 4', isScheduled: true });
    expect(push.body).toBe('Ana · $20.000 · En el local (Mesa 4) · Programado');
  });

  it('FCM recibe solo strings y sin campos vacíos', () => {
    const data = toFcmData(buildTestPush());
    expect(Object.values(data).every((v) => typeof v === 'string')).toBe(true);
    expect(data).not.toHaveProperty('orderId');
  });

  it('reconoce tokens que ya no sirven', () => {
    expect(isInvalidTokenError('messaging/registration-token-not-registered')).toBe(true);
    expect(isInvalidTokenError('messaging/internal-error')).toBe(false);
    expect(isInvalidTokenError(undefined)).toBe(false);
  });
});
