import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

import { cashApi } from '../services/cash.api';

/** Ajustes de caja (denominaciones, cuentas por medio de pago, caja general por defecto). */
export function useCashSettings(restaurantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.cashSettings(restaurantId ?? ''),
    queryFn: () => cashApi.getSettings(),
    enabled: enabled && !!restaurantId,
    staleTime: 1000 * 60 * 5,
  });
}
