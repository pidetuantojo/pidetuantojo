import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import type { SavePrinterConfigData } from '@/types';

import { printersService } from '../services/printers.service';

export function usePrinterConfig(restaurantId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.printer(restaurantId ?? ''),
    queryFn: () => printersService.getMain(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSavePrinterConfig(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SavePrinterConfigData) => printersService.saveMain(restaurantId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.printer(restaurantId) }),
  });
}
