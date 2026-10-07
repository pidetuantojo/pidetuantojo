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
  private _failureCount = 0;

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

    // ¿Había credenciales guardadas? Si sí y falla → sesión inválida (no red)
    const hadSavedSession = !!state.creds?.me;

    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS('Chrome'),
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this._qr = qr;
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        this._status = 'disconnected';
        this._qr = null;
        this.sock = null;
        this._initPromise = null;

        // Sesión guardada + cualquier falla = credenciales inválidas → limpiar y pedir QR nuevo
        if (hadSavedSession || isLoggedOut) {
          console.log('[WhatsApp] Sesión inválida — limpiando y esperando reconexión manual');
          this.clearSessionFiles();
          return; // el usuario verá el botón "Conectar" y escaneará QR nuevo
        }

        // Sin sesión previa y falló (ej: problema de red) → reintentar
        setTimeout(() => this.init(), 3000);
      }

      if (connection === 'open') {
        this._status = 'connected';
        this._qr = null;
        this._failureCount = 0;
        this._connectedNumber = this.sock?.user?.id?.split(':')[0] ?? null;
        this._initPromise = null;
      }
    });
  }

  async disconnect(): Promise<void> {
    try {
      if (this.sock) await this.sock.logout();
    } catch {}
    this.sock = null;
    this._status = 'disconnected';
    this._qr = null;
    this._connectedNumber = null;
    this._lastError = null;
    this._initPromise = null;
    this._failureCount = 0;
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
