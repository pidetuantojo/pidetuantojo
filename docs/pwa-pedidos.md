# PWA "Pedidos": app instalable + avisos con la app cerrada

Card: https://trello.com/c/qW9X7ao1

## Fase 1 — Instalable

| Pieza | Dónde |
|---|---|
| Manifest **solo del panel** | `public/panel.webmanifest` (`start_url: /dashboard/pedidos`, íconos `any` + `maskable`, atajos) |
| Enlace al manifest, iPhone y `theme-color` | `src/lib/pwa/panelMetadata.ts`, usado por `src/app/(dashboard)/layout.tsx` y `src/app/(auth)/layout.tsx` |
| Íconos maskable | `public/icons/maskable-{192,512}.png` (degradado de marca + "p" en la zona segura del 80%) |
| Registro del service worker + evento de instalación | `src/features/pwa/components/PwaRegister.tsx` (en `DashboardLayout`) |
| Botón "Instalar app" e instrucciones para iPhone | `src/features/pwa/components/PwaControls.tsx` (encabezado de Pedidos) |

**El menú público `/[slug]` no enlaza el manifest**: un cliente que agrega el menú a su inicio no termina en el login del panel.

## Fase 2 — Avisos push con la app cerrada

```
Cliente confirma en el menú
  → POST /api/orders crea el pedido
  → notifyNewOrder(restaurantId)          (src/lib/push/push.server.ts, tope 4 s, nunca rompe el pedido)
      → pushTokens where restaurantId      (tokens por dispositivo)
      → filtra usuarios activos con orders.view
      → FCM sendEach (solo `data`, prioridad alta)
      → borra tokens vencidos
  → public/sw.js recibe el push
      → panel visible en primer plano: no muestra (ya suena la voz)
      → si no: notificación del sistema
      → al tocarla: enfoca/abre /dashboard/pedidos?pedido={id} → OrdersManager abre el detalle
```

| Pieza | Dónde |
|---|---|
| Contenido del aviso (puro) | `src/lib/push/payload.ts` |
| Tokens, destinatarios, envío y limpieza | `src/lib/push/push.server.ts` |
| Activar / desactivar en el dispositivo | `POST` / `DELETE /api/push/register` (exige `orders.view`) |
| Enviar prueba | `POST /api/push/test` |
| Token de FCM en el navegador | `src/lib/firebase/messaging.ts` (`getToken` con el SW propio) |
| Estado y acciones en el panel | `src/features/pwa/hooks/usePushNotifications.ts` + `PwaControls` |
| Detección de iPhone / soporte | `src/lib/pwa/platform.ts` |

`pushTokens/{sha256(token)}` → `{ uid, restaurantId, token, platform, createdAt, updatedAt }`. Solo lo lee y escribe el servidor (`firestore.rules`: `allow read, write: if false`).

Los permisos se leen **al enviar**: si a un empleado le quitan `orders.view` o lo desactivan, deja de recibir avisos aunque su token siga guardado.

## Configuración (una sola vez)

1. Firebase Console → Configuración del proyecto → **Cloud Messaging** → Certificados push web → **Generar par de claves**.
2. Copiar la clave pública en `NEXT_PUBLIC_FIREBASE_VAPID_KEY` en `.env.local` **y en Vercel**, y volver a desplegar.
3. Verificar que la **API de Firebase Cloud Messaging (V1)** esté habilitada en Google Cloud.

Sin la clave, el panel muestra "Los avisos todavía no están configurados" y todo lo demás funciona igual.

## Limitaciones conocidas

- **iPhone/iPad**: push solo con la app **instalada** en la pantalla de inicio y iOS 16.4 o superior.
- **No molestar / ahorro de batería** pueden silenciar o retrasar los avisos.
- Los **pedidos manuales** del panel no generan aviso (los crea el mismo personal).
- Sin modo offline: el service worker no intercepta `fetch`.

## Cómo probar

1. Configurar la clave VAPID.
2. En Pedidos → **Activar avisos** → aceptar el permiso.
3. **Enviar prueba** → debe llegar una notificación (la prueba se muestra aunque el panel esté abierto).
4. Cerrar la app o bloquear la pantalla y crear un pedido de prueba en el menú de un restaurante **de prueba** (el entorno local usa la base de producción).
