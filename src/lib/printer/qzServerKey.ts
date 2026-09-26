// SOLO servidor (rutas API): lee el certificado y la clave privada de QZ Tray desde variables de entorno.
// Guía de configuración: docs/impresion-qz-tray.md

/**
 * Lee un PEM desde variables de entorno. Prioridad:
 * 1. `<NAME>_BASE64` — el PEM completo en base64, una sola línea (recomendado en Vercel:
 *    no tiene saltos de línea ni espacios que se rompan al pegar).
 * 2. `<NAME>` — el PEM con saltos reales o escritos como \n (compatibilidad / .env.local).
 */
function readPemEnv(name: 'QZ_PUBLIC_CERT' | 'QZ_PRIVATE_KEY'): string | null {
  const base64 = process.env[`${name}_BASE64`]?.replace(/\s/g, '');
  if (base64) return Buffer.from(base64, 'base64').toString('utf8').trim();

  const pem = process.env[name]?.replace(/\\n/g, '\n').trim();
  return pem || null;
}

/** Certificado público (QZ_PUBLIC_CERT_BASE64 o QZ_PUBLIC_CERT). */
export function getQzCertificate(): string | null {
  return readPemEnv('QZ_PUBLIC_CERT');
}

/** Clave privada (QZ_PRIVATE_KEY_BASE64 o QZ_PRIVATE_KEY). Nunca debe llegar al navegador. */
export function getQzPrivateKey(): string | null {
  return readPemEnv('QZ_PRIVATE_KEY');
}
