import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import type { SavePromotionData } from '@/types';

import { promotionsService } from '../services/promotions.service';

export function usePromotions(restaurantId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.promotions(restaurantId ?? ''),
    queryFn: () => promotionsService.getAll(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 1000 * 60,
  });
}

export function useCreatePromotion(restaurantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SavePromotionData) => promotionsService.create(restaurantId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.promotions(restaurantId) });
    },
  });
}

export function useUpdatePromotion(restaurantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SavePromotionData> }) =>
      promotionsService.update(restaurantId, id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.promotions(restaurantId) });
    },
  });
}

export function useDeletePromotion(restaurantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => promotionsService.delete(restaurantId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.promotions(restaurantId) });
    },
  });
}
