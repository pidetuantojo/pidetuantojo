import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

import { cashApi } from '../services/cash.api';

import { useIdempotencyKey } from './useIdempotencyKey';

/** Checklist de activación (`{ enabled, missing }`) y el interruptor del módulo. */
export function useCashActivation(restaurantId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const { keyFor, reset } = useIdempotencyKey();

  const query = useQuery({
    queryKey: QUERY_KEYS.cashActivation(restaurantId ?? ''),
    queryFn: () => cashApi.getActivation(),
    enabled: enabled && !!restaurantId,
    staleTime: 1000 * 30,
  });

  const mutation = useMutation({
    mutationFn: (next: boolean) => cashApi.setActivation(next, keyFor(`activation:${next}`)),
    onSuccess: async (status) => {
      reset();
      queryClient.setQueryData(QUERY_KEYS.cashActivation(restaurantId ?? ''), status);
      // useCashModule lee el documento del restaurante: hay que refrescarlo
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.restaurant(restaurantId ?? '') });
    },
  });

  return {
    ...query,
    setEnabled: mutation.mutateAsync,
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
}
