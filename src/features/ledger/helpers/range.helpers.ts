import { toAccountingDate } from '@/lib/shared/bogotaDate';

import type { DateRangeValue } from '../types/ledger.types';

/** Del primer día del mes en curso (Bogotá) a hoy. */
export function currentMonthRange(now: Date = new Date()): DateRangeValue {
  const today = toAccountingDate(now);
  return { from: `${today.slice(0, 8)}01`, to: today };
}
