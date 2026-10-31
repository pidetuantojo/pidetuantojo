import { describe, it, expect } from 'vitest';

import {
  BOGOTA_TZ,
  accountingDayRangeUtc,
  isValidAccountingDate,
  formatBogotaDateTime,
  formatBogotaTime,
  toAccountingDate,
} from '@/lib/shared/bogotaDate';

describe('toAccountingDate', () => {
  it('usa la zona de Bogotá', () => {
    expect(BOGOTA_TZ).toBe('America/Bogota');
  });

  it('borde de medianoche en Bogotá (UTC-5)', () => {
    expect(toAccountingDate('2026-10-31T04:59:59Z')).toBe('2026-10-30');
    expect(toAccountingDate('2026-10-31T05:00:00Z')).toBe('2026-10-31');
  });

  it('acepta Date y cruce de año', () => {
    expect(toAccountingDate(new Date('2027-01-01T04:59:59Z'))).toBe('2026-12-31');
    expect(toAccountingDate(new Date('2027-01-01T05:00:00Z'))).toBe('2027-01-01');
  });

  it('falla con fechas inválidas', () => {
    expect(() => toAccountingDate('no-es-fecha')).toThrow(RangeError);
  });
});

describe('accountingDayRangeUtc', () => {
  it('devuelve rango semiabierto UTC de 24h', () => {
    expect(accountingDayRangeUtc('2026-10-31')).toEqual({
      startIso: '2026-10-31T05:00:00.000Z',
      endIso: '2026-11-01T05:00:00.000Z',
    });
  });

  it('ida y vuelta: los bordes caen en el día correcto', () => {
    const { startIso, endIso } = accountingDayRangeUtc('2026-10-31');
    expect(toAccountingDate(startIso)).toBe('2026-10-31');
    expect(toAccountingDate(new Date(new Date(endIso).getTime() - 1))).toBe('2026-10-31');
    expect(toAccountingDate(endIso)).toBe('2026-11-01');
  });

  it('rechaza fechas inválidas', () => {
    expect(() => accountingDayRangeUtc('2026-02-30')).toThrow(RangeError);
  });
});

describe('isValidAccountingDate', () => {
  it('valida formato y calendario', () => {
    expect(isValidAccountingDate('2026-10-31')).toBe(true);
    expect(isValidAccountingDate('2028-02-29')).toBe(true);
    expect(isValidAccountingDate('2026-02-29')).toBe(false);
    expect(isValidAccountingDate('2026-13-01')).toBe(false);
    expect(isValidAccountingDate('31-10-2026')).toBe(false);
    expect(isValidAccountingDate(20261031)).toBe(false);
  });
});

describe('formatBogotaDateTime / formatBogotaTime', () => {
  it('muestra la hora de Bogotá (UTC-5), no la del navegador', () => {
    // 2026-10-31T13:30Z = 08:30 en Bogotá
    expect(formatBogotaTime('2026-10-31T13:30:00.000Z')).toMatch(/^0?8:30/);
    expect(formatBogotaDateTime('2026-10-31T13:30:00.000Z')).toMatch(/31/);
  });

  it('cruza el día: 02:00Z del 1 de nov es 9 pm del 31 de oct en Bogotá', () => {
    const text = formatBogotaDateTime('2026-11-01T02:00:00.000Z');
    expect(text).toMatch(/31/);
    expect(text).toMatch(/0?9:00/);
  });

  it('fecha inválida devuelve un guion', () => {
    expect(formatBogotaDateTime('nope')).toBe('—');
    expect(formatBogotaTime('nope')).toBe('—');
  });
});
