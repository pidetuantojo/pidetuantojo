import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import type { SaveRestaurantCategoryData } from '@/types';

import { restaurantCategoriesService } from '../services/restaurantCategories.service';

export function useRestaurantCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.restaurantCategories,
    queryFn: () => restaurantCategoriesService.getAll(),
    staleTime: 60_000,
  });
}

export function useRestaurantCategory(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.restaurantCategory(id ?? ''),
    queryFn: () => restaurantCategoriesService.getById(id!),
    enabled: !!id,
  });
}

export function useSaveRestaurantCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: SaveRestaurantCategoryData }) => {
      if (id) {
        await restaurantCategoriesService.update(id, data);
        return id;
      }
      return restaurantCategoriesService.create(data);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: QUERY_KEYS.restaurantCategories }),
  });
}

export function useSetRestaurantCategoryActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      restaurantCategoriesService.setActive(id, isActive),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QUERY_KEYS.restaurantCategories }),
  });
}

export function useDeleteRestaurantCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantCategoriesService.delete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QUERY_KEYS.restaurantCategories }),
  });
}
