import type { Money } from '@/lib/shared/money';

/** Más dígitos que esto nunca es un entero seguro (9.007.199.254.740.991 tiene 16). */
const MAX_DIGITS = 16;

export type MoneyParse = { ok: true; value: Money | null } | { ok: false };

/**
 * Convierte lo que escribe la persona en un entero: ignora todo lo que no sea dígito (puntos y
 * comas de miles, espacios, "$", letras). Vacío = null. Nunca usa parseFloat.
 */
export function parseMoneyInput(raw: string): MoneyParse {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (digits === '') return { ok: true, value: null };
  if (digits.length > MAX_DIGITS) return { ok: false };
  const value = Number(digits);
  return Number.isSafeInteger(value) ? { ok: true, value } : { ok: false };
}

/** "15000" -> "15.000" (sin símbolo; el "$" lo pone el componente). */
export function formatMoneyInput(value: Money | null): string {
  if (value === null) return '';
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
