import { describe, it, expect } from 'vitest';

import {
  MoneyError,
  assertMoney,
  formatCOP,
  isMoney,
  moneySchema,
  positiveMoneySchema,
  sumMoney,
} from '@/lib/shared/money';
import { formatCurrency } from '@/lib/utils';

describe('isMoney / assertMoney', () => {
  it('acepta enteros seguros', () => {
    expect(isMoney(0)).toBe(true);
    expect(isMoney(15000)).toBe(true);
    expect(isMoney(-500)).toBe(true);
  });

  it('rechaza decimales, NaN, Infinity, inseguros y no numéricos', () => {
    for (const bad of [1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100', null, undefined]) {
      expect(isMoney(bad)).toBe(false);
      expect(() => assertMoney(bad)).toThrow(MoneyError);
    }
  });

  it('respeta allowNegative y allowZero', () => {
    expect(() => assertMoney(-1)).toThrow(MoneyError);
    expect(() => assertMoney(-1, { allowNegative: true })).not.toThrow();
    expect(() => assertMoney(0, { allowZero: false })).toThrow(MoneyError);
    expect(() => assertMoney(0)).not.toThrow();
  });
});

describe('sumMoney', () => {
  it('suma enteros exactos', () => {
    expect(sumMoney([10000, 5000, -2500])).toBe(12500);
    expect(sumMoney([])).toBe(0);
  });

  it('falla con decimales o desbordes', () => {
    expect(() => sumMoney([100, 0.5])).toThrow(MoneyError);
    expect(() => sumMoney([Number.MAX_SAFE_INTEGER, 1])).toThrow(MoneyError);
  });
});

describe('formatCOP', () => {
  it('formatea pesos sin decimales (es-CO)', () => {
    expect(formatCOP(15000).replace(/\s/g, '')).toBe('$15.000');
    expect(formatCOP(0).replace(/\s/g, '')).toBe('$0');
  });

  it('formatCurrency delega en formatCOP', () => {
    expect(formatCurrency(30000)).toBe(formatCOP(30000));
  });
});

describe('moneySchema', () => {
  it('acepta enteros no negativos', () => {
    expect(moneySchema.safeParse(0).success).toBe(true);
    expect(moneySchema.safeParse(1200).success).toBe(true);
  });

  it('rechaza negativos, decimales y no seguros', () => {
    for (const bad of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1, 'x']) {
      expect(moneySchema.safeParse(bad).success).toBe(false);
    }
  });

  it('positiveMoneySchema rechaza cero', () => {
    expect(positiveMoneySchema.safeParse(0).success).toBe(false);
    expect(positiveMoneySchema.safeParse(1).success).toBe(true);
  });
});
