// Teléfono del cliente como identidad (promociones "1 por cliente", primer pedido y fidelidad).
// Lógica pura: la usan el checkout, el servidor y los tests.

const COUNTRY_CODE = '57';

/**
 * Clave del cliente a partir de lo que escribió en el checkout.
 * "300 123 4567", "+57 3001234567", "(300) 123-4567" y "573001234567" → "3001234567".
 * Devuelve null si no parece un teléfono (menos de 7 dígitos).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  let digits = (raw ?? '').replace(/\D/g, '');
  // Indicativo de Colombia: 57 + celular (3xx) o fijo (60x)
  if (digits.length === 12 && digits.startsWith(COUNTRY_CODE)) digits = digits.slice(2);
  // Celulares escritos con 0 adelante o con 0057
  if (digits.length === 14 && digits.startsWith(`00${COUNTRY_CODE}`)) digits = digits.slice(4);
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

/**
 * Formas en que pudo quedar guardado el teléfono en pedidos viejos (antes de `customerPhoneKey`),
 * para reconocer clientes que ya habían pedido. Máximo 10 (límite de `in` en Firestore).
 */
export function phoneVariants(key: string): string[] {
  const variants = new Set<string>([key, `+${COUNTRY_CODE}${key}`, `${COUNTRY_CODE}${key}`, `+${COUNTRY_CODE} ${key}`]);
  if (key.length === 10) {
    const [a, b, c] = [key.slice(0, 3), key.slice(3, 6), key.slice(6)];
    variants.add(`${a} ${b} ${c}`);
    variants.add(`${a} ${b}${c}`);
    variants.add(`${a}-${b}-${c}`);
    variants.add(`(${a}) ${b}-${c}`);
    variants.add(`+${COUNTRY_CODE} ${a} ${b} ${c}`);
  }
  return Array.from(variants).slice(0, 10);
}
