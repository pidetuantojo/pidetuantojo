import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

import { cashReportsApi } from '../services/cash.reports.api';

export function useDailySummary(restaurantId: string | undefined, date: string) {
  return useQuery({
    queryKey: QUERY_KEYS.cashReportDaily(restaurantId ?? '', date),
    queryFn: () => cashReportsApi.getDailySummary(date),
    enabled: !!restaurantId && !!date,
    staleTime: 1000 * 30,
    retry: false,
  });
}

export function useShiftReport(restaurantId: string | undefined, shiftId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.cashReportShift(restaurantId ?? '', shiftId),
    queryFn: () => cashReportsApi.getShiftReport(shiftId),
    enabled: !!restaurantId && !!shiftId,
    staleTime: 1000 * 30,
    retry: false,
  });
}

export function usePettyReport(
  restaurantId: string | undefined,
  registerId: string,
  from: string,
  to: string
) {
  return useQuery({
    queryKey: QUERY_KEYS.cashReportPetty(restaurantId ?? '', registerId, from, to),
    queryFn: () => cashReportsApi.getPettyReport(registerId, from, to),
    enabled: !!restaurantId && !!registerId,
    staleTime: 1000 * 30,
    retry: false,
  });
}
