import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import type { CreateMesaData, UpdateMesaData } from '@/types';
import { publicMenuMeta } from '@/lib/menu/invalidatePublicMenu';
import { mesasService } from '../services/mesas.service';

export function useCreateMesa(restaurantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMesaData) => mesasService.create(restaurantId, data),
    meta: publicMenuMeta(restaurantId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mesas(restaurantId) });
    },
  });
}

export function useUpdateMesa(restaurantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMesaData }) =>
      mesasService.update(restaurantId, id, data),
    meta: publicMenuMeta(restaurantId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mesas(restaurantId) });
    },
  });
}

export function useDeleteMesa(restaurantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mesasService.delete(restaurantId, id),
    meta: publicMenuMeta(restaurantId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mesas(restaurantId) });
    },
  });
}
