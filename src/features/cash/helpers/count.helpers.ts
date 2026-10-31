import type { CountMap, Denomination } from '@/lib/cash/cash.types';
import { compactCount, computeCountTotal } from '@/lib/cash/denominations.helpers';
import type { Money } from '@/lib/shared/money';

/** Total en pesos de un conteo; ignora llaves desconocidas (nunca lanza en la UI). */
export function countTotal(count: CountMap, denominations: readonly Denomination[]): Money {
  const known = new Set(denominations.map((d) => d.key));
  const safe = Object.fromEntries(Object.entries(count).filter(([key]) => known.has(key)));
  try {
    return computeCountTotal(safe, denominations);
  } catch {
    return 0;
  }
}

export function rowSubtotal(denomination: Denomination, quantity: number): Money {
  return denomination.value * quantity;
}

/** Billetes primero y de mayor a menor valor. */
export function sortDenominations(denominations: readonly Denomination[]): Denomination[] {
  return [...denominations].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'BILLETE' ? -1 : 1;
    return b.value - a.value;
  });
}

/** Cantidad escrita por la persona: solo dígitos, entero seguro y no negativo. */
export function parseQuantity(raw: string): number {
  const digits = raw.replace(/\D/g, '').slice(0, 7);
  return digits === '' ? 0 : Number(digits);
}

/** Cambia la cantidad de una denominación y deja el conteo compacto (sin ceros). */
export function setQuantity(count: CountMap, key: string, quantity: number): CountMap {
  return compactCount({ ...count, [key]: quantity });
}
