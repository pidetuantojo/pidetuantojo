// public/sw.js en una sandbox: muestra avisos con la app cerrada, no duplica con el panel en primer
// plano y abre el pedido al tocar la notificación.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

type Handler = (event: Record<string, unknown>) => void;

function loadServiceWorker(windows: Array<{ url: string; visibilityState: string; focus?: () => Promise<void>; navigate?: (u: string) => Promise<void> }>) {
  const handlers: Record<string, Handler> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const self = {
    addEventListener: (type: string, fn: Handler) => { handlers[type] = fn; },
    skipWaiting: vi.fn(),
    clients: { matchAll: vi.fn().mockResolvedValue(windows), openWindow, claim: vi.fn() },
    registration: { showNotification },
    location: { origin: 'https://app.test' },
  };
  vm.runInNewContext(readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8'), { self, URL });

  async function dispatch(type: string, event: Record<string, unknown>) {
    const pending: Promise<unknown>[] = [];
    handlers[type]({ ...event, waitUntil: (p: Promise<unknown>) => pending.push(p) });
    await Promise.all(pending);
  }
  return { dispatch, showNotification, openWindow };
}

const pushEvent = (data: Record<string, string>) => ({
  data: { json: () => ({ data, from: '123', fcmMessageId: 'm1' }), text: () => '' },
});

const NEW_ORDER = { kind: 'new_order', title: '🛎 Nuevo pedido #1', body: 'Ana · $20.000', url: '/dashboard/pedidos?pedido=o1', tag: 'order-o1' };

describe('service worker', () => {
  it('con la app cerrada muestra la notificación del pedido', async () => {
    const sw = loadServiceWorker([]);
    await sw.dispatch('push', pushEvent(NEW_ORDER));
    expect(sw.showNotification).toHaveBeenCalledWith('🛎 Nuevo pedido #1', expect.objectContaining({
      body: 'Ana · $20.000', tag: 'order-o1', requireInteraction: true, data: { url: '/dashboard/pedidos?pedido=o1' },
    }));
  });

  it('con el panel abierto y visible no duplica (ya suena la voz)', async () => {
    const sw = loadServiceWorker([{ url: 'https://app.test/dashboard/pedidos', visibilityState: 'visible' }]);
    await sw.dispatch('push', pushEvent(NEW_ORDER));
    expect(sw.showNotification).not.toHaveBeenCalled();
  });

  it('con el panel en segundo plano sí avisa; la prueba siempre se muestra', async () => {
    const hidden = loadServiceWorker([{ url: 'https://app.test/dashboard/pedidos', visibilityState: 'hidden' }]);
    await hidden.dispatch('push', pushEvent(NEW_ORDER));
    expect(hidden.showNotification).toHaveBeenCalledOnce();

    const visible = loadServiceWorker([{ url: 'https://app.test/dashboard/pedidos', visibilityState: 'visible' }]);
    await visible.dispatch('push', pushEvent({ kind: 'test', title: 'Prueba', body: 'ok', url: '/dashboard/pedidos', tag: 'test' }));
    expect(visible.showNotification).toHaveBeenCalledOnce();
  });

  it('al tocarla enfoca el panel abierto y navega al pedido', async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn().mockResolvedValue(undefined);
    const sw = loadServiceWorker([{ url: 'https://app.test/dashboard/estados', visibilityState: 'hidden', focus, navigate }]);
    const close = vi.fn();
    await sw.dispatch('notificationclick', { notification: { close, data: { url: '/dashboard/pedidos?pedido=o1' } } });
    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('https://app.test/dashboard/pedidos?pedido=o1');
    expect(sw.openWindow).not.toHaveBeenCalled();
  });

  it('sin panel abierto abre una ventana nueva en el pedido', async () => {
    const sw = loadServiceWorker([{ url: 'https://app.test/mangova', visibilityState: 'visible' }]);
    await sw.dispatch('notificationclick', { notification: { close: vi.fn(), data: { url: '/dashboard/pedidos?pedido=o1' } } });
    expect(sw.openWindow).toHaveBeenCalledWith('https://app.test/dashboard/pedidos?pedido=o1');
  });
});
