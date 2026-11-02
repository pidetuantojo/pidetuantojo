// Reglas puras de cobro de suscripciones (sin Firebase): las usa el servidor al registrar un pago
// y el panel del super admin para mostrar la vista previa del nuevo vencimiento.
// Las fechas son días calendario de Colombia en formato YYYY-MM-DD.

export const GRACE_BUSINESS_DAYS = 5;
// Días gratis de prueba para un restaurante nuevo (solo al crearlo, una única vez)
export const TRIAL_DAYS = 15;

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const isYmd = (value: unknown): value is string => typeof value === 'string' && YMD.test(value);

/** Hoy en Colombia (YYYY-MM-DD). */
export function todayYmd(now = new Date()): string {
  return new Date(now.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** El instante en que empieza ese día en Colombia (00:00 -05:00). */
export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00-05:00`);
}

function parts(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Suma meses calendario conservando el día de corte (`anchorDay`): si el mes no tiene ese día,
 * cae en el último. Ej: corte 31 → 30 nov, 31 dic, 28 feb, 31 mar.
 */
export function addMonths(ymd: string, months: number, anchorDay = parts(ymd).d): string {
  const { y, m } = parts(ymd);
  const total = (m - 1) + months;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(anchorDay, daysInMonth(year, month));
  return fromUtc(new Date(Date.UTC(year, month - 1, day)));
}

/** Suma días calendario. */
export function addDays(ymd: string, days: number): string {
  const { y, m, d } = parts(ymd);
  return fromUtc(new Date(Date.UTC(y, m - 1, d + days)));
}

/**
 * Campos de suscripción de un restaurante nuevo: arranca con la prueba gratis. Su primer pago
 * sigue desde el fin de la prueba, así el primer mes queda como 1 mes + los días de prueba.
 */
export function trialSubscriptionFields(startYmd: string) {
  const trialEnd = addDays(startYmd, TRIAL_DAYS);
  return { subscriptionEndDate: trialEnd, subscriptionTrialEndDate: trialEnd };
}

/** Suma días hábiles (lunes a viernes). */
export function addBusinessDays(ymd: string, days: number): string {
  const { y, m, d } = parts(ymd);
  const date = new Date(Date.UTC(y, m - 1, d));
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) added++;
  }
  return fromUtc(date);
}

/** Último día en que el restaurante sigue funcionando sin pagar (fin de la gracia). */
export const graceEndYmd = (endYmd: string) => addBusinessDays(endYmd, GRACE_BUSINESS_DAYS);

export interface PaymentPeriodInput {
  /** Vencimiento actual (null = nunca tuvo uno). */
  currentEnd: string | null;
  /** Día de corte guardado (para no correr la fecha mes a mes). */
  anchorDay?: number;
  paidAt: string;
  periods: number;
  billingPeriod: 'monthly' | 'yearly';
}

export interface PaymentPeriod {
  periodStart: string;
  periodEnd: string;
  anchorDay: number;
  /** true = sigue desde el vencimiento anterior; false = arranca de nuevo desde el día del pago. */
  continues: boolean;
}

/**
 * Qué período cubre un pago:
 * - Pagó antes de vencer o dentro de la gracia → sigue desde el vencimiento anterior (no pierde días
 *   pagados ni se le regalan los de gracia).
 * - Pagó estando suspendido (pasada la gracia) o es su primer pago → arranca el día del pago.
 */
export function computePaymentPeriod({ currentEnd, anchorDay, paidAt, periods, billingPeriod }: PaymentPeriodInput): PaymentPeriod {
  const months = periods * (billingPeriod === 'yearly' ? 12 : 1);
  const continues = !!currentEnd && paidAt <= graceEndYmd(currentEnd);
  const periodStart = continues ? currentEnd! : paidAt;
  const anchor = continues ? (anchorDay ?? parts(currentEnd!).d) : parts(paidAt).d;
  return { periodStart, periodEnd: addMonths(periodStart, months, anchor), anchorDay: anchor, continues };
}

/**
 * Vencimiento actual del restaurante (YYYY-MM-DD). Si todavía no tiene `subscriptionEndDate`
 * (restaurantes anteriores al registro de pagos) se calcula como antes: inicio + 30 o 365 días.
 */
export function currentEndYmd(
  restaurant: { subscriptionEndDate?: string; subscriptionStartDate?: string },
  billingPeriod?: 'monthly' | 'yearly',
): string | null {
  if (isYmd(restaurant.subscriptionEndDate)) return restaurant.subscriptionEndDate;
  if (!restaurant.subscriptionStartDate) return null;
  const start = new Date(restaurant.subscriptionStartDate);
  if (Number.isNaN(start.getTime())) return null;
  start.setUTCDate(start.getUTCDate() + (billingPeriod === 'yearly' ? 365 : 30));
  // La fecha de inicio se guardaba como medianoche UTC del día elegido: su día UTC es el que se quiso
  return fromUtc(start);
}
