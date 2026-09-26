'use client';

import type * as QzTray from 'qz-tray';

import { auth } from '@/lib/firebase/config';
import type { PrinterEncoding } from '@/types';

type Qz = typeof QzTray;

let qzPromise: Promise<Qz> | null = null;
let connecting: Promise<void> | null = null;

/** Carga qz-tray solo en el navegador (usa WebSocket/window) y configura la firma una sola vez. */
function loadQz(): Promise<Qz> {
  if (!qzPromise) {
    qzPromise = import('qz-tray').then((mod) => {
      // El paquete hace `module.exports = qz`; según el bundler llega como default o como el módulo
      const qz = ((mod as unknown as { default?: Qz }).default ?? mod) as Qz;
      configureSecurity(qz);
      return qz;
    });
  }
  return qzPromise;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  return { Authorization: `Bearer ${token}` };
}

/**
 * Certificado público + firma server-side (la clave privada nunca llega al navegador).
 * Con el certificado instalado como "override" en QZ Tray, la impresión queda sin diálogos.
 */
function configureSecurity(qz: Qz) {
  qz.security.setCertificatePromise((resolve, reject) => {
    fetch('/api/qz/cert', { cache: 'no-store' })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('No se pudo obtener el certificado'))))
      .then(resolve, reject);
  });

  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise((toSign: string) => (resolve, reject) => {
    authHeader()
      .then((headers) =>
        fetch('/api/qz/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ request: toSign }),
        })
      )
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('No se pudo firmar la solicitud de impresión'))))
      .then(resolve, reject);
  });
}

/** Conecta al WebSocket local de QZ Tray (reutiliza la conexión si ya existe). */
export async function ensureConnected(): Promise<Qz> {
  const qz = await loadQz();
  if (qz.websocket.isActive()) return qz;
  if (!connecting) {
    connecting = qz.websocket
      .connect({ retries: 1, delay: 1 })
      .finally(() => { connecting = null; });
  }
  await connecting;
  return qz;
}

/** true si QZ Tray está abierto en este equipo. */
export async function isQzAvailable(): Promise<boolean> {
  try {
    await ensureConnected();
    return true;
  } catch {
    return false;
  }
}

export async function getQzVersion(): Promise<string | null> {
  try {
    const qz = await ensureConnected();
    return (await qz.api.getVersion()) as string;
  } catch {
    return null;
  }
}

/** Nombres exactos de las impresoras que ve QZ Tray. */
export async function listPrinters(): Promise<string[]> {
  const qz = await ensureConnected();
  const found = await qz.printers.find();
  return Array.isArray(found) ? found : [found];
}

/** Envía comandos ESC/POS crudos a la impresora. */
export async function printRaw(printerName: string, data: string, encoding: PrinterEncoding): Promise<void> {
  const qz = await ensureConnected();
  const config = qz.configs.create(printerName, {
    // Java charset: los acentos se codifican en la página de códigos que seleccionó ESC t
    encoding: encoding === 'cp850' ? 'Cp850' : 'US-ASCII',
  });
  await qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data }]);
}

/** Mensaje entendible para el usuario a partir de un error de QZ Tray o de la red. */
export function describePrintError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (/websocket|connect|unable to establish/i.test(raw)) {
    return 'QZ Tray no está abierto en este equipo.';
  }
  if (/printer .*not found|cannot find printer/i.test(raw)) {
    return 'No se encontró la impresora configurada. Revisa que esté encendida y conectada.';
  }
  if (/firmar|certificado|sesión/i.test(raw)) return raw;
  return raw || 'No se pudo imprimir.';
}
