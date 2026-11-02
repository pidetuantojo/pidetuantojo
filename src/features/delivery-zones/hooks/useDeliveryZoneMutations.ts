import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import type { CreateDeliveryZoneData, UpdateDeliveryZoneData } from '@/types';
import { publicMenuMeta } from '@/lib/menu/invalidatePublicMenu';

import { deliveryZonesService } from '../services/delivery-zones.service';

export function useCreateDeliveryZone(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDeliveryZoneData) =>
      deliveryZonesService.create(restaurantId, data),
    meta: publicMenuMeta(restaurantId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.deliveryZones(restaurantId) });
    },
  });
}

export function useUpdateDeliveryZone(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDeliveryZoneData }) =>
      deliveryZonesService.update(restaurantId, id, data),
    meta: publicMenuMeta(restaurantId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.deliveryZones(restaurantId) });
    },
  });
}

export function useDeleteDeliveryZone(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deliveryZonesService.delete(restaurantId, id),
    meta: publicMenuMeta(restaurantId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.deliveryZones(restaurantId) });
    },
  });
}
