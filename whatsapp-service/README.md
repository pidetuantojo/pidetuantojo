# WhatsApp Service

Servicio Node.js independiente que mantiene sesiones de WhatsApp por restaurante usando [Baileys](https://github.com/WhiskeySockets/Baileys) (protocolo no oficial, funciona como un dispositivo vinculado — igual que WhatsApp Web).

Está desplegado en **Fly.io** (`pidetuantojo-wa`) y es llamado por el backend de Next.js (Vercel) para conectar WhatsApp y enviar notificaciones automáticas cuando un pedido cambia de estado.

---

## Por qué existe este servicio separado

Next.js en Vercel es **serverless** — cada request levanta un proceso nuevo y lo mata al terminar. Baileys necesita mantener una conexión WebSocket abierta de forma persistente para recibir/enviar mensajes. Eso es imposible en Vercel.

La solución: un proceso Node.js corriendo **24/7** en Fly.io que mantiene las sesiones activas en memoria y en disco, y expone una API HTTP simple que Vercel consulta.

```
Cliente → Vercel (Next.js) → Fly.io (este servicio) → WhatsApp
```

---

## Estructura

```
whatsapp-service/
├── src/
│   ├── server.ts          # Express HTTP server — define los endpoints
│   └── sessionManager.ts  # Lógica de Baileys — una sesión por restaurante
├── Dockerfile             # Imagen para Fly.io
├── fly.toml               # Configuración de Fly.io
├── package.json
└── tsconfig.json
```

### `sessionManager.ts`

Contiene dos clases:

**`WhatsAppSession`** — representa la sesión de un restaurante:
- `init()` — inicia la conexión y genera el QR
- `disconnect()` — cierra la sesión y limpia los archivos
- `sendMessage(phone, text)` — envía un mensaje de texto
- `getState()` — devuelve `{ status, qr, connectedNumber, lastError }`

**`SessionManager`** — un `Map<restaurantId, WhatsAppSession>` global:
- `getOrCreate(restaurantId)` — crea la sesión si no existe
- `get(restaurantId)` — obtiene la sesión existente
- `remove(restaurantId)` — elimina la sesión del mapa

Las sesiones se persisten en disco en `/data/sessions/{restaurantId}/` (volumen Fly.io), así sobreviven reinicios del proceso.

**Lógica de sesión inválida:** si había credenciales guardadas y la conexión falla (el usuario desvinculó el dispositivo desde el teléfono), Baileys no genera un QR nuevo — detectamos esto con `hadSavedSession` y limpiamos los archivos para forzar un QR fresco.

### `server.ts`

Express en el puerto `3001`. Todos los endpoints requieren el header `x-api-key` con el valor de la variable de entorno `API_KEY` (si no está configurada, el servidor corre abierto — solo para dev local).

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check — devuelve `{ ok: true }` |
| `GET` | `/status?restaurantId=` | Estado actual de la sesión + QR como data URL |
| `POST` | `/connect?restaurantId=` | Inicia la conexión (fire and forget) |
| `DELETE` | `/connect?restaurantId=` | Desconecta y limpia la sesión |
| `POST` | `/notify` | Envía un mensaje de WhatsApp |

Body de `/notify`:
```json
{
  "restaurantId": "abc123",
  "phone": "3001234567",
  "message": "Hola! Tu pedido fue confirmado ✅"
}
```

---

## Variables de entorno

| Variable | Descripción | Dónde configurar |
|----------|-------------|-----------------|
| `API_KEY` | Clave secreta para autenticar requests desde Vercel | Fly.io secrets |
| `PORT` | Puerto del servidor (default: `3001`) | `fly.toml` (ya configurado) |
| `SESSIONS_DIR` | Directorio de sesiones (default: `/data/sessions`) | `fly.toml` (ya configurado) |

En Vercel también hay que configurar:

| Variable | Valor |
|----------|-------|
| `WHATSAPP_SERVICE_URL` | `https://pidetuantojo-wa.fly.dev` |
| `WHATSAPP_API_KEY` | El mismo valor que `API_KEY` en Fly.io |

---

## Infraestructura en Fly.io

- **App:** `pidetuantojo-wa`
- **Región:** `dfw` (Dallas)
- **Máquina:** 1 CPU, 256 MB RAM
- **Volumen:** `sessions_data` montado en `/data` — persiste las sesiones entre deploys
- `auto_stop_machines = 'off'` — la máquina **nunca se apaga**, sin cold starts

---

## Cómo hacer un cambio y desplegarlo

### Opción A — Deploy automático (recomendado)

Cualquier push a `main` que toque archivos dentro de `whatsapp-service/**` dispara el workflow de GitHub Actions (`.github/workflows/deploy-whatsapp.yml`) y despliega automáticamente.

```bash
# Hacer el cambio en whatsapp-service/src/
git add whatsapp-service/
git commit -m "feat(whatsapp): descripción del cambio"
git push origin main
# GitHub Actions hace el deploy a Fly.io automáticamente
```

### Opción B — Deploy manual desde la terminal

Requiere tener `flyctl` instalado y estar autenticado (`fly auth login`).

```bash
cd whatsapp-service
fly deploy --remote-only -a pidetuantojo-wa
```

El flag `--remote-only` usa el builder remoto de Fly.io en vez de construir la imagen localmente.

---

## Desarrollo local

```bash
cd whatsapp-service
npm install
npm run dev
# Corre en http://localhost:3001
```

En dev no hace falta `API_KEY` — el middleware la omite si no está configurada.

Para probar los endpoints localmente:

```bash
# Health check
curl http://localhost:3001/health

# Iniciar sesión
curl -X POST "http://localhost:3001/connect?restaurantId=test"

# Ver estado + QR
curl "http://localhost:3001/status?restaurantId=test"

# Enviar mensaje
curl -X POST http://localhost:3001/notify \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"test","phone":"3001234567","message":"Hola!"}'
```

---

## Ver logs en producción

```bash
fly logs -a pidetuantojo-wa
```

Los logs muestran eventos de conexión con el prefijo `[WA:{restaurantId}]`:
```
[WA:abc123] Conectado — 573001234567
[WA:abc123] Sesión inválida — limpiando
```

---

## Gestionar el secreto API_KEY

```bash
# Ver secrets configurados
fly secrets list -a pidetuantojo-wa

# Actualizar la clave
fly secrets set API_KEY=nueva-clave-secreta -a pidetuantojo-wa
```

Después de cambiar `API_KEY` en Fly.io, también hay que actualizar `WHATSAPP_API_KEY` en las variables de entorno de Vercel para que los valores coincidan.

