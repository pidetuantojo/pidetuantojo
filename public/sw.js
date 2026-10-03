/* Service worker de la PWA "Pedidos" (Pide Tu Antojo).
 * - Recibe los avisos push de Firebase Cloud Messaging (mensajes solo con `data`, ver src/lib/push/payload.ts)
 *   y muestra la notificación del sistema, aunque la app esté cerrada o la pantalla bloqueada.
 * - Si el panel está abierto y en primer plano, un pedido nuevo NO genera notificación: ya suena el aviso
 *   de voz de la página (no se duplica). La prueba siempre se muestra.
 * - Al tocar la notificación abre (o enfoca) el panel en el pedido.
 * Sin librerías ni caché offline: no intercepta `fetch`.
 */

const DEFAULT_URL = '/dashboard/pedidos';
const ICON = '/android-chrome-192.png';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/** FCM entrega `{ data: {...}, from, fcmMessageId }`; se aceptan otras formas por si acaso. */
function readPayload(event) {
  if (!event.data) return {};
  try {
    const json = event.data.json();
    return json.data || json.notification || json;
  } catch (e) {
    return { body: event.data.text() };
  }
}

async function panelInForeground() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return windows.some((client) => {
    try {
      return client.visibilityState === 'visible' && new URL(client.url).pathname.startsWith('/dashboard');
    } catch (e) {
      return false;
    }
  });
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const data = readPayload(event);
    if (data.kind === 'new_order' && (await panelInForeground())) return;

    await self.registration.showNotification(data.title || 'Pide Tu Antojo', {
      body: data.body || '',
      icon: ICON,
      tag: data.tag || undefined,
      renotify: !!data.tag,
      // El pedido queda en pantalla hasta que alguien lo vea
      requireInteraction: data.kind === 'new_order',
      vibrate: [250, 120, 250, 120, 400],
      data: { url: data.url || DEFAULT_URL },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || DEFAULT_URL, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reusar una ventana del panel si ya está abierta
    const panel = windows.find((client) => {
      try {
        return new URL(client.url).pathname.startsWith('/dashboard');
      } catch (e) {
        return false;
      }
    });
    if (panel) {
      await panel.focus();
      if ('navigate' in panel) {
        try {
          await panel.navigate(target);
          return;
        } catch (e) {
          // Algunos navegadores no permiten navegar una ventana no controlada: se abre otra
        }
      } else {
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
