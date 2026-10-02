import { describe, it, expect } from 'vitest';

import { getPromotionStatus, isScheduleActiveAt, zonedParts } from '@/features/promotions/engine';
import { normalizePhone, phoneVariants } from '@/lib/customers/phone';

describe('zonedParts (hora de Colombia)', () => {
  it('convierte UTC a America/Bogota', () => {
    // 2026-10-15 03:30 UTC = 2026-10-14 22:30 en Colombia (miércoles)
    expect(zonedParts(new Date('2026-10-15T03:30:00Z'))).toEqual({ date: '2026-10-14', weekday: 3, minutes: 22 * 60 + 30 });
  });
});

describe('isScheduleActiveAt', () => {
  const at = (iso: string) => new Date(iso);
  it('rango de fechas inclusivo', () => {
    const s = { startDate: '2026-10-01', endDate: '2026-10-14' };
    expect(isScheduleActiveAt(s, at('2026-10-15T04:00:00Z'))).toBe(true); // 14 oct 23:00 COL
    expect(isScheduleActiveAt(s, at('2026-10-15T05:00:00Z'))).toBe(false); // 15 oct 00:00 COL
  });
  it('sin horario siempre aplica', () => {
    expect(isScheduleActiveAt(undefined, new Date())).toBe(true);
  });
});

describe('getPromotionStatus', () => {
  const now = new Date('2026-10-14T21:00:00Z');
  const base = { isActive: true, usesCount: 0 };
  it('estados del panel', () => {
    expect(getPromotionStatus({ ...base }, now)).toBe('active');
    expect(getPromotionStatus({ ...base, isActive: false }, now)).toBe('paused');
    expect(getPromotionStatus({ ...base, schedule: { endDate: '2026-10-01' } }, now)).toBe('expired');
    expect(getPromotionStatus({ ...base, schedule: { startDate: '2026-11-01' } }, now)).toBe('scheduled');
    expect(getPromotionStatus({ ...base, maxUses: 5, usesCount: 5 }, now)).toBe('exhausted');
    expect(getPromotionStatus({ ...base, schedule: { daysOfWeek: [6] } }, now)).toBe('off_hours');
  });
});

describe('normalizePhone', () => {
  it.each([
    ['300 123 4567', '3001234567'],
    ['+57 300 123 4567', '3001234567'],
    ['573001234567', '3001234567'],
    ['(300) 123-4567', '3001234567'],
    ['00573001234567', '3001234567'],
  ])('%s → %s', (raw, key) => {
    expect(normalizePhone(raw)).toBe(key);
  });
  it('rechaza lo que no es un teléfono', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
  it('variantes para reconocer pedidos viejos (máximo 10 para Firestore `in`)', () => {
    const v = phoneVariants('3001234567');
    expect(v).toContain('3001234567');
    expect(v).toContain('300 123 4567');
    expect(v).toContain('+573001234567');
    expect(v.length).toBeLessThanOrEqual(10);
  });
});
