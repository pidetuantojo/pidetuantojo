export const REASON_MIN = 5;
export const REASON_MAX = 500;

/** Mismo rango que valida el servidor (5-500 caracteres sin espacios sobrantes). */
export function reasonError(raw: string): string | null {
  const length = raw.trim().length;
  if (length < REASON_MIN) return `El motivo debe tener al menos ${REASON_MIN} caracteres`;
  if (length > REASON_MAX) return `El motivo no puede superar ${REASON_MAX} caracteres`;
  return null;
}
