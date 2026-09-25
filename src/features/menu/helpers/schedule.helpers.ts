import type { DaySchedule, OpeningHours } from '@/types';

export const SCHEDULE_MIN_MINUTES = 30;
export const SCHEDULE_MAX_DAYS = 7;

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function hasOpeningHours(openingHours?: OpeningHours): boolean {
  if (!openingHours) return false;
  return Object.values(openingHours).some((v) => v !== null && v !== undefined);
}

export function getDaySchedule(openingHours: OpeningHours | undefined, date: Date): DaySchedule | null {
  return openingHours?.[date.getDay()] ?? null;
}

/** true si la fecha/hora cae dentro del horario de atención (soporta cierre pasada la medianoche). */
export function isWithinOpeningHours(openingHours: OpeningHours | undefined, date: Date): boolean {
  if (!hasOpeningHours(openingHours)) return true;
  const mins = date.getHours() * 60 + date.getMinutes();

  const today = getDaySchedule(openingHours, date);
  if (today) {
    const o = toMinutes(today.open);
    const c = toMinutes(today.close);
    if (c <= o ? mins >= o : mins >= o && mins < c) return true;
  }

  // Turno del día anterior que cruza la medianoche
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prev = getDaySchedule(openingHours, prevDate);
  if (prev) {
    const o = toMinutes(prev.open);
    const c = toMinutes(prev.close);
    if (c <= o && mins < c) return true;
  }

  return false;
}

/** Combina los valores de <input type="date"> y <input type="time"> en un Date local. */
export function parseScheduleInput(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getScheduleBounds(now: Date = new Date()): { min: Date; max: Date } {
  const min = new Date(now.getTime() + SCHEDULE_MIN_MINUTES * 60_000);
  const max = new Date(now.getTime() + SCHEDULE_MAX_DAYS * 24 * 60 * 60_000);
  return { min, max };
}

/** Devuelve un mensaje de error o null si la fecha programada es válida. */
export function validateScheduledDate(
  scheduled: Date | null,
  openingHours: OpeningHours | undefined,
  now: Date = new Date()
): string | null {
  if (!scheduled) return 'Elegí fecha y hora';
  const { min, max } = getScheduleBounds(now);
  if (scheduled.getTime() < min.getTime()) {
    return `Debe ser al menos ${SCHEDULE_MIN_MINUTES} minutos en el futuro`;
  }
  if (scheduled.getTime() > max.getTime()) {
    return `Máximo ${SCHEDULE_MAX_DAYS} días hacia adelante`;
  }
  if (!isWithinOpeningHours(openingHours, scheduled)) {
    const day = getDaySchedule(openingHours, scheduled);
    return day
      ? `Fuera del horario de atención (${DAY_NAMES[scheduled.getDay()]}: ${fmtHour(day.open)} – ${fmtHour(day.close)})`
      : `El restaurante no atiende el ${DAY_NAMES[scheduled.getDay()]}`;
  }
  return null;
}

export function fmtHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m)} ${ap}`;
}

/** Ej: "sábado 26 de septiembre, 7:30 PM" */
export function formatScheduledDate(date: Date): string {
  const day = date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day}, ${fmtHour(`${pad(date.getHours())}:${pad(date.getMinutes())}`)}`;
}
