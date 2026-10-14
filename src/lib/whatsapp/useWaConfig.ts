'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { getWaConfig, saveWaConfig, type WaConfig } from './waConfig';

export function useWaConfig(restaurantId: string) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.waConfig(restaurantId),
    queryFn: () => getWaConfig(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (config: Partial<WaConfig>) => saveWaConfig(restaurantId, config),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.waConfig(restaurantId) });
    },
  });

  return {
    autoNotify: data?.autoNotify ?? false,
    isLoading,
    setAutoNotify: (value: boolean) => mutation.mutate({ autoNotify: value }),
    isSaving: mutation.isPending,
  };
}
