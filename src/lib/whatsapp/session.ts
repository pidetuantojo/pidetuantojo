import path from 'path';
import fs from 'fs';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';

type WaStatus = 'disconnected' | 'connecting' | 'connected';

// Solo estos códigos significan credenciales inválidas. El resto (408, 428, 503, 515…)
// son cortes normales de WhatsApp/red y se reconecta conservando la sesión.
const INVALID_SESSION_CODES = new Set<number>([DisconnectReason.loggedOut, DisconnectReason.badSession]);
const RETRY_BASE_MS = 3_000;
const RETRY_MAX_MS = 60_000;

interface WaState {
  status: WaStatus;
  qr: string | null;
  connectedNumber: string | null;
  lastError: string | null;
}

class WhatsAppSession {
  private sock: WASocket | null = null;
  private _status: WaStatus = 'disconnected';
  private _qr: string | null = null;
  private _connectedNumber: string | null = null;
  private _lastError: string | null = null;
  private _initPromise: Promise<void> | null = null;
  private _retryCount = 0;
  private _retryTimer: NodeJS.Timeout | null = null;

  getState(): WaState {
    return {
      status: this._status,
      qr: this._qr,
      connectedNumber: this._connectedNumber,
      lastError: this._lastError,
    };
  }

  async init(): Promise<void> {
    if (this._status === 'connected') return;
    if (this._initPromise) return this._initPromise;
    if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
    this._initPromise = this._connect()
      .catch((err) => {
        this._status = 'disconnected';
        this._lastError = err instanceof Error ? err.message : String(err);
        this._initPromise = null;
        console.error('[WhatsApp] Error en init:', err);
      })
      .finally(() => {
        if (this._status !== 'connected') this._initPromise = null;
      });
    return this._initPromise;
  }

  private clearSessionFiles(): void {
    const sessionDir = path.join(process.cwd(), '.whatsapp-sessions');
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {}
  }

  private async _connect(): Promise<void> {
    this._status = 'connecting';
    this._qr = null;
    this._lastError = null;

    const sessionDir = path.join(process.cwd(), '.whatsapp-sessions');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS('Chrome'),
    });
    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      // Ignorar eventos de un socket viejo ya reemplazado o desconectado a mano
      if (this.sock !== sock) return;

      if (qr) {
        this._qr = qr;
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;

        this._status = 'disconnected';
        this._qr = null;
        this.sock = null;
        this._initPromise = null;
        this._lastError = `Conexión cerrada (código ${statusCode ?? 'desconocido'})`;

        // Credenciales inválidas → limpiar y pedir QR nuevo
        if (statusCode !== undefined && INVALID_SESSION_CODES.has(statusCode)) {
          console.log(`[WhatsApp] Sesión inválida (${statusCode}) — limpiando y esperando reconexión manual`);
          this._connectedNumber = null;
          this._retryCount = 0;
          this.clearSessionFiles();
          return; // el usuario verá el botón "Conectar" y escaneará QR nuevo
        }

        // Corte normal (red, timeout, restart) → reintentar conservando credenciales
        this.scheduleReconnect(statusCode);
      }

      if (connection === 'open') {
        this._status = 'connected';
        this._qr = null;
        this._lastError = null;
        this._retryCount = 0;
        this._connectedNumber = sock.user?.id?.split(':')[0] ?? null;
        this._initPromise = null;
      }
    });
  }

  private scheduleReconnect(statusCode: number | undefined): void {
    if (this._retryTimer) clearTimeout(this._retryTimer);
    const delay = Math.min(RETRY_BASE_MS * 2 ** this._retryCount, RETRY_MAX_MS);
    this._retryCount++;
    console.log(`[WhatsApp] Conexión cerrada (${statusCode}) — reintento #${this._retryCount} en ${delay}ms`);
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this.init().catch(() => {});
    }, delay);
  }

  async disconnect(): Promise<void> {
    if (this._retryTimer) clearTimeout(this._retryTimer);
    this._retryTimer = null;
    this._retryCount = 0;
    const sock = this.sock;
    this.sock = null; // antes del logout: el 'close' resultante se ignora
    try {
      if (sock) await sock.logout();
    } catch {}
    this._status = 'disconnected';
    this._qr = null;
    this._connectedNumber = null;
    this._lastError = null;
    this._initPromise = null;
    this.clearSessionFiles();
  }

  async sendMessage(phone: string, text: string): Promise<void> {
    if (!this.sock || this._status !== 'connected') {
      throw new Error('WhatsApp no está conectado');
    }

    // Normaliza número colombiano: 3001234567 → 573001234567@s.whatsapp.net
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.startsWith('57') ? digits : `57${digits}`;
    const jid = `${normalized}@s.whatsapp.net`;

    await this.sock.sendMessage(jid, { text });
  }
}

// Singleton global: sobrevive hot-reload en dev y requests en el mismo proceso
declare global {
  // eslint-disable-next-line no-var
  var __waSession: WhatsAppSession | undefined;
}

export function getWhatsAppSession(): WhatsAppSession {
  if (!global.__waSession) {
    global.__waSession = new WhatsAppSession();
  }
  return global.__waSession;
}
