import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { mesasService } from '../services/mesas.service';

export function useMesas(restaurantId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.mesas(restaurantId ?? ''),
    queryFn: () => mesasService.getAll(restaurantId!),
    enabled: !!restaurantId,
  });
}
