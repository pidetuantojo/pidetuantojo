// SOLO servidor (rutas API): lee el certificado y la clave privada de QZ Tray desde variables de entorno.
// Guía de configuración: docs/impresion-qz-tray.md

const PEM_RE = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/;

/**
 * Reconstruye un PEM limpio aunque se haya pegado "mal": saltos convertidos en espacios,
 * `\n` escritos, CRLF, comillas alrededor o todo en una línea. Toma el contenido base64 entre
 * BEGIN/END, le quita cualquier espacio y lo vuelve a partir en líneas de 64 caracteres.
 */
export function normalizePem(input: string): string | null {
  const text = input.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
  const match = text.match(PEM_RE);
  if (!match) return null;
  const [, type, body] = match;
  const base64 = body.replace(/[^A-Za-z0-9+/=]/g, '');
  if (!base64) return null;
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`;
}

/** Convierte el valor de una variable (PEM o PEM en base64) a PEM limpio, o null si no se puede. */
export function parsePemValue(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const direct = normalizePem(raw);
  if (direct) return direct;
  // No trae BEGIN/END visible: se asume base64 del PEM completo
  const compact = raw.trim().replace(/^["']|["']$/g, '').replace(/\s/g, '');
  try {
    return normalizePem(Buffer.from(compact, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

type PemName = 'QZ_PUBLIC_CERT' | 'QZ_PRIVATE_KEY';

/** Variable usada (la _BASE64 tiene prioridad) y su valor crudo. */
function pemSource(name: PemName): { variable: string; raw: string } | null {
  for (const variable of [`${name}_BASE64`, name]) {
    const raw = process.env[variable];
    if (raw?.trim()) return { variable, raw };
  }
  return null;
}

export interface PemResult {
  pem: string | null;
  // Variable de donde se leyó (para mensajes de error); null si no hay ninguna configurada
  variable: string | null;
}

function readPem(name: PemName): PemResult {
  const source = pemSource(name);
  if (!source) return { pem: null, variable: null };
  return { pem: parsePemValue(source.raw), variable: source.variable };
}

/** Certificado público (QZ_PUBLIC_CERT_BASE64 o QZ_PUBLIC_CERT; acepta PEM o base64 en cualquiera). */
export function getQzCertificate(): PemResult {
  return readPem('QZ_PUBLIC_CERT');
}

/** Clave privada (QZ_PRIVATE_KEY_BASE64 o QZ_PRIVATE_KEY). Nunca debe llegar al navegador. */
export function getQzPrivateKey(): PemResult {
  return readPem('QZ_PRIVATE_KEY');
}

/**
 * Datos para diagnosticar un certificado mal cargado. SOLO para el certificado (es público):
 * nunca usar con la clave privada.
 */
export function describePublicCertValue(): { variable: string; largo: number; inicio: string; fin: string } | null {
  const source = pemSource('QZ_PUBLIC_CERT');
  if (!source) return null;
  const value = source.raw.trim();
  return { variable: source.variable, largo: value.length, inicio: value.slice(0, 40), fin: value.slice(-30) };
}
