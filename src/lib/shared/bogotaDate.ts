// Fecha contable: el día calendario en Bogotá (UTC−5, sin horario de verano).
export const BOGOTA_TZ = 'America/Bogota';
const BOGOTA_OFFSET_HOURS = 5;

const ACCOUNTING_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BOGOTA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD de un instante, en hora de Bogotá. */
export function toAccountingDate(date: Date | string): string {
  const instant = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(instant.getTime())) throw new RangeError('Fecha inválida');
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isValidAccountingDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ACCOUNTING_DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

/** Rango UTC semiabierto [startIso, endIso) que cubre el día contable de Bogotá. */
export function accountingDayRangeUtc(accountingDate: string): { startIso: string; endIso: string } {
  if (!isValidAccountingDate(accountingDate)) throw new RangeError('Fecha contable inválida');
  const [y, mo, d] = accountingDate.split('-').map(Number);
  const start = Date.UTC(y, mo - 1, d, BOGOTA_OFFSET_HOURS);
  return {
    startIso: new Date(start).toISOString(),
    endIso: new Date(start + 24 * 60 * 60 * 1000).toISOString(),
  };
}
