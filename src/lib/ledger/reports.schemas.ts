// Validación (zod) de los parámetros de consulta de los reportes contables.
import { z } from 'zod';

import { isValidAccountingDate } from '@/lib/shared/bogotaDate';

import { JOURNAL_DEFAULT_LIMIT, JOURNAL_MAX_LIMIT } from './reports.helpers';

export const accountingDateParam = z
  .string()
  .refine(isValidAccountingDate, 'La fecha debe tener formato AAAA-MM-DD');

export const dateRangeSchema = z
  .object({ from: accountingDateParam, to: accountingDateParam })
  .refine((r) => r.from <= r.to, 'La fecha inicial no puede ser posterior a la final');

export const journalQuerySchema = z
  .object({
    from: accountingDateParam,
    to: accountingDateParam,
    cursor: z.string().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(JOURNAL_MAX_LIMIT).default(JOURNAL_DEFAULT_LIMIT),
  })
  .refine((r) => r.from <= r.to, 'La fecha inicial no puede ser posterior a la final');

export const ledgerQuerySchema = z
  .object({
    accountId: z.string().min(1).max(128),
    from: accountingDateParam,
    to: accountingDateParam,
  })
  .refine((r) => r.from <= r.to, 'La fecha inicial no puede ser posterior a la final');

/** Convierte los query params de una URL en un objeto plano para zod (`null` → ausente). */
export function searchParamsObject(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  new URL(request.url).searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
