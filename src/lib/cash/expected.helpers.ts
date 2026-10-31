// Efectivo esperado y diferencias de cierre. Puro: la fuente son los movimientos APLICADOS.
import { sumMoney, type Money } from '@/lib/shared/money';

import type { CashMovement, MoneyByMethod } from './cash.types';

export type ExpectedInput = Pick<CashMovement, 'direction' | 'amount' | 'methodType' | 'status'>;

/**
 * Esperado por medio de pago = Σ entradas aplicadas − Σ salidas aplicadas.
 * La base de apertura cuenta como entrada; un movimiento reversado y su reverso son ambos aplicados
 * y de sentido contrario, así que se anulan solos. Pendientes y rechazados no cuentan.
 */
export function computeExpectedByMethod(movements: readonly ExpectedInput[]): MoneyByMethod {
  const result: MoneyByMethod = {};
  for (const m of movements) {
    if (m.status !== 'APLICADO') continue;
    const signed = m.direction === 'IN' ? m.amount : -m.amount;
    result[m.methodType] = sumMoney([result[m.methodType] ?? 0, signed]);
  }
  return result;
}

/** base + ventas ef. + ingresos ef. − egresos − retiros − devoluciones ef. */
export function computeExpectedCash(movements: readonly ExpectedInput[]): Money {
  return computeExpectedByMethod(movements).efectivo ?? 0;
}

/** declarado − esperado por cada medio declarado (el efectivo contado entra como `efectivo`). */
export function computeDifferences(expected: MoneyByMethod, counted: MoneyByMethod): MoneyByMethod {
  const result: MoneyByMethod = {};
  for (const [method, value] of Object.entries(counted) as [keyof MoneyByMethod, Money][]) {
    result[method] = value - (expected[method] ?? 0);
  }
  return result;
}
