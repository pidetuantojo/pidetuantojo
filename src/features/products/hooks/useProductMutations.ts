import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import type { CreateProductData, UpdateProductData } from '@/types';
import { publicMenuMeta } from '@/lib/menu/invalidatePublicMenu';

import { productsService } from '../services/products.service';

export function useCreateProduct(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductData) => productsService.create(data),
    meta: publicMenuMeta(restaurantId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products(restaurantId) });
    },
  });
}

export function useUpdateProduct(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductData }) =>
      productsService.update(restaurantId, id, data),
    meta: publicMenuMeta(restaurantId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products(restaurantId) });
    },
  });
}

export function useToggleProductAvailable(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      productsService.toggleAvailable(restaurantId, id, isAvailable),
    meta: publicMenuMeta(restaurantId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products(restaurantId) });
    },
  });
}

export function useDeleteProduct(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productsService.delete(restaurantId, id),
    meta: publicMenuMeta(restaurantId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products(restaurantId) });
    },
  });
}
