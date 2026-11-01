// Validación (zod) de los parámetros de consulta de los reportes de caja.
import { z } from 'zod';

import { accountingDateParam } from '@/lib/ledger/reports.schemas';

export const dailyQuerySchema = z.object({ date: accountingDateParam });

export const pettyReportQuerySchema = z
  .object({
    registerId: z.string().min(1).max(128),
    from: accountingDateParam,
    to: accountingDateParam,
  })
  .refine((r) => r.from <= r.to, 'La fecha inicial no puede ser posterior a la final');
