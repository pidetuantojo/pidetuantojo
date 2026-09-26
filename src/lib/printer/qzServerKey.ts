// SOLO servidor (rutas API): lee la clave privada de QZ Tray desde variables de entorno.

/**
 * Prioridad:
 * 1. QZ_PRIVATE_KEY_BASE64 — el PEM completo en base64, una sola línea (recomendado en Vercel:
 *    no tiene saltos de línea ni espacios que se rompan al pegar).
 * 2. QZ_PRIVATE_KEY — el PEM con saltos reales o escritos como \n (compatibilidad / .env.local).
 */
export function getQzPrivateKey(): string | null {
  const base64 = process.env.QZ_PRIVATE_KEY_BASE64?.replace(/\s/g, '');
  if (base64) return Buffer.from(base64, 'base64').toString('utf8').trim();

  const pem = process.env.QZ_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  return pem || null;
}
