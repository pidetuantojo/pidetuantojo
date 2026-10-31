'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

import {
  deleteCustomTemplate, getWaTemplateStore, saveCustomTemplate, saveSystemTemplate,
  type WaEventCode,
} from './templates';

export function useWaTemplates(restaurantId: string) {
  const queryClient = useQueryClient();
  const key = QUERY_KEYS.waTemplates(restaurantId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const query = useQuery({
    queryKey: key,
    queryFn: () => getWaTemplateStore(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });

  const saveSystem = useMutation({
    mutationFn: ({ code, body }: { code: WaEventCode; body: string }) => saveSystemTemplate(restaurantId, code, body),
    onSuccess: invalidate,
  });

  const saveCustom = useMutation({
    mutationFn: (t: { id?: string; name: string; body: string; createdAt?: string }) => saveCustomTemplate(restaurantId, t),
    onSuccess: invalidate,
  });

  const removeCustom = useMutation({
    mutationFn: (id: string) => deleteCustomTemplate(restaurantId, id),
    onSuccess: invalidate,
  });

  return { store: query.data, isLoading: query.isLoading, saveSystem, saveCustom, removeCustom };
}
