import { describe, it, expect } from 'vitest';
import {
  isWithinOpeningHours,
  parseScheduleInput,
  validateScheduledDate,
} from '@/features/menu/helpers/schedule.helpers';
import type { OpeningHours } from '@/types';

// Jueves 24/09/2026 12:00 local
const NOW = new Date(2026, 8, 24, 12, 0);

const HOURS: OpeningHours = {
  0: null, // domingo cerrado
  1: { open: '09:00', close: '19:00' },
  2: { open: '09:00', close: '19:00' },
  3: { open: '09:00', close: '19:00' },
  4: { open: '09:00', close: '19:00' },
  5: { open: '18:00', close: '02:00' }, // viernes cruza medianoche
  6: { open: '10:00', close: '22:00' },
};

describe('parseScheduleInput', () => {
  it('combina fecha y hora en un Date local', () => {
    expect(parseScheduleInput('2026-09-24', '14:30')).toEqual(new Date(2026, 8, 24, 14, 30));
  });

  it('devuelve null si falta algún campo', () => {
    expect(parseScheduleInput('', '14:30')).toBeNull();
    expect(parseScheduleInput('2026-09-24', '')).toBeNull();
  });
});

describe('isWithinOpeningHours', () => {
  it('sin horario configurado no restringe', () => {
    expect(isWithinOpeningHours(undefined, new Date(2026, 8, 27, 3, 0))).toBe(true);
    expect(isWithinOpeningHours({}, new Date(2026, 8, 27, 3, 0))).toBe(true);
  });

  it('respeta apertura y cierre del día', () => {
    expect(isWithinOpeningHours(HOURS, new Date(2026, 8, 24, 9, 0))).toBe(true);
    expect(isWithinOpeningHours(HOURS, new Date(2026, 8, 24, 19, 0))).toBe(false);
    expect(isWithinOpeningHours(HOURS, new Date(2026, 8, 24, 8, 59))).toBe(false);
  });

  it('día cerrado', () => {
    expect(isWithinOpeningHours(HOURS, new Date(2026, 8, 27, 12, 0))).toBe(false);
  });

  it('turno que cruza la medianoche cuenta para el día siguiente', () => {
    expect(isWithinOpeningHours(HOURS, new Date(2026, 8, 25, 23, 0))).toBe(true); // viernes 23:00
    expect(isWithinOpeningHours(HOURS, new Date(2026, 8, 26, 1, 30))).toBe(true); // sábado 01:30
    expect(isWithinOpeningHours(HOURS, new Date(2026, 8, 26, 2, 0))).toBe(false);
  });
});

describe('validateScheduledDate', () => {
  it('pide fecha y hora si no hay', () => {
    expect(validateScheduledDate(null, HOURS, NOW)).toMatch(/fecha y hora/);
  });

  it('rechaza menos de 30 minutos en el futuro', () => {
    expect(validateScheduledDate(new Date(2026, 8, 24, 12, 20), HOURS, NOW)).toMatch(/30 minutos/);
  });

  it('acepta exactamente 30 minutos', () => {
    expect(validateScheduledDate(new Date(2026, 8, 24, 12, 30), HOURS, NOW)).toBeNull();
  });

  it('rechaza más de 7 días adelante', () => {
    expect(validateScheduledDate(new Date(2026, 9, 1, 12, 1), HOURS, NOW)).toMatch(/7 días/);
  });

  it('rechaza fuera del horario', () => {
    expect(validateScheduledDate(new Date(2026, 8, 24, 20, 0), HOURS, NOW)).toMatch(/horario/);
  });

  it('rechaza día cerrado', () => {
    expect(validateScheduledDate(new Date(2026, 8, 27, 12, 0), HOURS, NOW)).toMatch(/no atiende/);
  });
});
