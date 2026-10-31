// Denominaciones y conteo de efectivo. Puro.
import { isMoney, type Money } from '@/lib/shared/money';

import { CashError } from './cash.errors';
import type { CountMap, Denomination } from './cash.types';

const BILLETES = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
const MONEDAS = [1000, 500, 200, 100, 50];

/** Semilla de denominaciones COP: el resto del código trabaja con `CashSettings.denominations`. */
export const DEFAULT_DENOMINATIONS: readonly Denomination[] = [
  ...BILLETES.map((value): Denomination => ({ key: `BILLETE_${value}`, value, kind: 'BILLETE' })),
  ...MONEDAS.map((value): Denomination => ({ key: `MONEDA_${value}`, value, kind: 'MONEDA' })),
];

/** Total en pesos de un conteo. Rechaza llaves desconocidas, cantidades no enteras o negativas. */
export function computeCountTotal(count: CountMap, denominations: readonly Denomination[]): Money {
  const byKey = new Map(denominations.map((d) => [d.key, d]));
  let total = 0;
  for (const [key, qty] of Object.entries(count)) {
    const denomination = byKey.get(key);
    if (!denomination) throw new CashError('INVALID_COUNT', `Denominación desconocida: ${key}`);
    if (!Number.isSafeInteger(qty) || qty < 0) {
      throw new CashError('INVALID_COUNT', `Cantidad inválida para ${key}`);
    }
    total += denomination.value * qty;
    if (!isMoney(total)) {
      throw new CashError('INVALID_COUNT', 'El total del conteo es demasiado grande');
    }
  }
  return total;
}

/** Quita denominaciones en cero para guardar conteos compactos. */
export function compactCount(count: CountMap): CountMap {
  return Object.fromEntries(Object.entries(count).filter(([, qty]) => qty > 0));
}
