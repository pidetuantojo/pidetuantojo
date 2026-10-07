import express from 'express';
import QRCode from 'qrcode';
import { sessionManager } from './sessionManager';

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY;
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ── Auth middleware ───────────────────────────────────────────────────────────

app.use((req, res, next) => {
  if (!API_KEY) return next(); // sin API_KEY configurada: modo dev abierto
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ── GET /status?restaurantId= ─────────────────────────────────────────────────

app.get('/status', async (req, res) => {
  const restaurantId = String(req.query.restaurantId ?? '');
  if (!restaurantId) { res.status(400).json({ error: 'restaurantId requerido' }); return; }

  const session = sessionManager.get(restaurantId);
  const state = session?.getState() ?? { status: 'disconnected', qr: null, connectedNumber: null, lastError: null };

  let qrDataUrl: string | null = null;
  if (state.qr) {
    qrDataUrl = await QRCode.toDataURL(state.qr, { width: 256, margin: 2 });
  }

  res.json({ ...state, qr: qrDataUrl });
});

// ── POST /connect?restaurantId= ───────────────────────────────────────────────

app.post('/connect', (req, res) => {
  const restaurantId = String(req.query.restaurantId ?? (req.body as any)?.restaurantId ?? '');
  if (!restaurantId) { res.status(400).json({ error: 'restaurantId requerido' }); return; }

  const session = sessionManager.getOrCreate(restaurantId);
  session.init().catch(() => {});
  res.json({ ok: true });
});

// ── DELETE /connect?restaurantId= ────────────────────────────────────────────

app.delete('/connect', async (req, res) => {
  const restaurantId = String(req.query.restaurantId ?? (req.body as any)?.restaurantId ?? '');
  if (!restaurantId) { res.status(400).json({ error: 'restaurantId requerido' }); return; }

  const session = sessionManager.get(restaurantId);
  if (session) {
    await session.disconnect();
    sessionManager.remove(restaurantId);
  }
  res.json({ ok: true });
});

// ── POST /notify ──────────────────────────────────────────────────────────────

app.post('/notify', async (req, res) => {
  const { restaurantId, phone, message } = req.body as {
    restaurantId?: string;
    phone?: string;
    message?: string;
  };

  if (!restaurantId || !phone || !message) {
    res.status(400).json({ error: 'restaurantId, phone y message son requeridos' });
    return;
  }

  const session = sessionManager.get(restaurantId);
  if (!session) {
    res.status(503).json({ error: 'No hay sesión activa para este restaurante' });
    return;
  }

  try {
    await session.sendMessage(phone, message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al enviar' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`WhatsApp service corriendo en puerto ${PORT}`);
});
