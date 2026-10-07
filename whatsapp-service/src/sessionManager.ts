import path from 'path';
import fs from 'fs';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';

export type WaStatus = 'disconnected' | 'connecting' | 'connected';

export interface SessionState {
  status: WaStatus;
  qr: string | null;
  connectedNumber: string | null;
  lastError: string | null;
}

const SESSIONS_DIR = process.env.SESSIONS_DIR ?? path.join(process.cwd(), 'sessions');

class WhatsAppSession {
  readonly restaurantId: string;
  private sock: WASocket | null = null;
  private _status: WaStatus = 'disconnected';
  private _qr: string | null = null;
  private _connectedNumber: string | null = null;
  private _lastError: string | null = null;
  private _initPromise: Promise<void> | null = null;

  constructor(restaurantId: string) {
    this.restaurantId = restaurantId;
  }

  getState(): SessionState {
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
        console.error(`[WA:${this.restaurantId}] Error en init:`, err);
      })
      .finally(() => {
        if (this._status !== 'connected') this._initPromise = null;
      });
    return this._initPromise;
  }

  private sessionDir(): string {
    return path.join(SESSIONS_DIR, this.restaurantId);
  }

  private clearFiles(): void {
    try { fs.rmSync(this.sessionDir(), { recursive: true, force: true }); } catch {}
  }

  private async _connect(): Promise<void> {
    this._status = 'connecting';
    this._qr = null;
    this._lastError = null;

    const dir = this.sessionDir();
    fs.mkdirSync(dir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(dir);
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
      if (qr) this._qr = qr;

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        this._status = 'disconnected';
        this._qr = null;
        this.sock = null;
        this._initPromise = null;

        if (hadSavedSession || isLoggedOut) {
          console.log(`[WA:${this.restaurantId}] Sesión inválida — limpiando`);
          this.clearFiles();
          return;
        }

        setTimeout(() => this.init(), 3000);
      }

      if (connection === 'open') {
        this._status = 'connected';
        this._qr = null;
        this._connectedNumber = this.sock?.user?.id?.split(':')[0] ?? null;
        this._initPromise = null;
        console.log(`[WA:${this.restaurantId}] Conectado — ${this._connectedNumber}`);
      }
    });
  }

  async disconnect(): Promise<void> {
    try { if (this.sock) await this.sock.logout(); } catch {}
    this.sock = null;
    this._status = 'disconnected';
    this._qr = null;
    this._connectedNumber = null;
    this._lastError = null;
    this._initPromise = null;
    this.clearFiles();
  }

  async sendMessage(phone: string, text: string): Promise<void> {
    if (!this.sock || this._status !== 'connected') {
      throw new Error('WhatsApp no está conectado');
    }
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.startsWith('57') ? digits : `57${digits}`;
    await this.sock.sendMessage(`${normalized}@s.whatsapp.net`, { text });
  }
}

// Manager global — una sesión por restaurantId
class SessionManager {
  private sessions = new Map<string, WhatsAppSession>();

  getOrCreate(restaurantId: string): WhatsAppSession {
    if (!this.sessions.has(restaurantId)) {
      this.sessions.set(restaurantId, new WhatsAppSession(restaurantId));
    }
    return this.sessions.get(restaurantId)!;
  }

  get(restaurantId: string): WhatsAppSession | undefined {
    return this.sessions.get(restaurantId);
  }

  remove(restaurantId: string): void {
    this.sessions.delete(restaurantId);
  }
}

export const sessionManager = new SessionManager();
