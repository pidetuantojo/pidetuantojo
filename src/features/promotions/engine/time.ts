import type { Promotion, PromotionSchedule } from '@/types';

/**
 * Las promociones se evalúan en la hora del restaurante, no en la del navegador ni la del servidor
 * (Vercel corre en UTC). Todos los restaurantes están en Colombia (UTC−5, sin horario de verano).
 */
export const RESTAURANT_TIMEZONE = 'America/Bogota';

// Minutos de gracia: si la promoción vence mientras el cliente arma el carrito, se respeta
export const PROMOTION_GRACE_MINUTES = 10;

export interface ZonedParts {
  // YYYY-MM-DD
  date: string;
  // 0 = domingo … 6 = sábado
  weekday: number;
  // Minutos desde la medianoche
  minutes: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Fecha, día de la semana y minutos en la zona horaria indicada. */
export function zonedParts(date: Date, timeZone = RESTAURANT_TIMEZONE): ZonedParts {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(date).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS[parts.weekday] ?? 0,
    minutes: hour * 60 + Number(parts.minute),
  };
}

/** "18:30" → 1110. Formato inválido → null. */
export function parseTime(value: string | undefined): number | null {
  const m = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** ¿El horario (fechas, días y franja) incluye este momento? */
export function isScheduleActiveAt(schedule: PromotionSchedule | undefined, date: Date, timeZone = RESTAURANT_TIMEZONE): boolean {
  if (!schedule) return true;
  const { date: today, weekday, minutes } = zonedParts(date, timeZone);

  if (schedule.startDate && today < schedule.startDate) return false;
  if (schedule.endDate && today > schedule.endDate) return false;

  const start = parseTime(schedule.startTime);
  const end = parseTime(schedule.endTime);
  let dayToCheck = weekday;

  if (start !== null && end !== null && start !== end) {
    if (start < end) {
      if (minutes < start || minutes >= end) return false;
    } else {
      // Cruza la medianoche (ej. 22:00–02:00): la madrugada pertenece al día en que empezó
      if (minutes >= end && minutes < start) return false;
      if (minutes < end) dayToCheck = (weekday + 6) % 7;
    }
  }

  const days = schedule.daysOfWeek;
  if (days && days.length > 0 && days.length < 7 && !days.includes(dayToCheck)) return false;
  return true;
}

export type PromotionStatus = 'active' | 'off_hours' | 'scheduled' | 'paused' | 'expired' | 'exhausted';

export const PROMOTION_STATUS_LABEL: Record<PromotionStatus, string> = {
  active: 'Activa',
  off_hours: 'Fuera de horario',
  scheduled: 'Programada',
  paused: 'Pausada',
  expired: 'Vencida',
  exhausted: 'Agotada',
};

/** Estado para el panel del restaurante. */
export function getPromotionStatus(
  promotion: Pick<Promotion, 'isActive' | 'schedule' | 'maxUses' | 'usesCount'>,
  now: Date,
  timeZone = RESTAURANT_TIMEZONE
): PromotionStatus {
  const today = zonedParts(now, timeZone).date;
  const { schedule } = promotion;
  if (schedule?.endDate && today > schedule.endDate) return 'expired';
  if (promotion.maxUses && (promotion.usesCount ?? 0) >= promotion.maxUses) return 'exhausted';
  if (!promotion.isActive) return 'paused';
  if (schedule?.startDate && today < schedule.startDate) return 'scheduled';
  return isScheduleActiveAt(schedule, now, timeZone) ? 'active' : 'off_hours';
}
