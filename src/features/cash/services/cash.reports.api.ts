import type { DailySummary, PettyReport, ShiftReport } from '@/lib/cash/reports.types';

import { request } from './cash.http';

const enc = encodeURIComponent;

/** Reportes de caja: resumen diario, cierre por turno y estado de caja menor. */
export const cashReportsApi = {
  getDailySummary: (date: string) =>
    request<DailySummary>(`/api/cash/reports/daily?date=${enc(date)}`),

  getShiftReport: (shiftId: string) =>
    request<ShiftReport>(`/api/cash/reports/shifts/${enc(shiftId)}`),

  getPettyReport: (registerId: string, from: string, to: string) =>
    request<PettyReport>(
      `/api/cash/reports/petty?registerId=${enc(registerId)}&from=${enc(from)}&to=${enc(to)}`
    ),
};
