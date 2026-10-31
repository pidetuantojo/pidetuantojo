// Dinero: pesos colombianos enteros (number). Nunca decimales ni centavos.
import { z } from 'zod';

export type Money = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export interface MoneyRules {
  allowNegative?: boolean;
  allowZero?: boolean;
}

export function isMoney(value: unknown): value is Money {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** Lanza `MoneyError` si el valor no es un entero seguro (o viola las reglas de signo). */
export function assertMoney(value: unknown, rules: MoneyRules = {}): asserts value is Money {
  const { allowNegative = false, allowZero = true } = rules;
  if (!isMoney(value)) throw new MoneyError('El monto debe ser un número entero de pesos');
  if (value < 0 && !allowNegative) throw new MoneyError('El monto no puede ser negativo');
  if (value === 0 && !allowZero) throw new MoneyError('El monto debe ser mayor a cero');
}

export function sumMoney(values: readonly Money[]): Money {
  return values.reduce<Money>((total, value) => {
    assertMoney(value, { allowNegative: true });
    const next = total + value;
    assertMoney(next, { allowNegative: true });
    return next;
  }, 0);
}

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "$ 15.000" (formato de Intl es-CO). */
export function formatCOP(amount: number): string {
  return copFormatter.format(amount);
}

export const moneySchema = z.number().int().safe().nonnegative();
export const positiveMoneySchema = z.number().int().safe().positive();
