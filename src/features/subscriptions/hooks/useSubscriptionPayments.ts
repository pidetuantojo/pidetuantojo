'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

import { subscriptionPaymentsService, type RegisterPaymentFields } from '../services/subscriptionPayments.service';

export function useSubscriptionPayments(restaurantId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.subscriptionPayments(restaurantId),
    queryFn: () => subscriptionPaymentsService.listByRestaurant(restaurantId),
    enabled: !!restaurantId,
  });
}

/** Todos los pagos de todos los restaurantes (pantalla Pagos del super admin). */
export function useAllSubscriptionPayments() {
  return useQuery({
    queryKey: QUERY_KEYS.subscriptionPaymentsAll,
    queryFn: () => subscriptionPaymentsService.listAll(),
  });
}

/** Al registrar o anular cambia el vencimiento: se refrescan los historiales (el del restaurante y el general) y los restaurantes. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['subscription-payments'] }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.restaurants }),
  ]);
}

export function useRegisterSubscriptionPayment(restaurantId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (fields: Omit<RegisterPaymentFields, 'restaurantId'>) => subscriptionPaymentsService.register({ ...fields, restaurantId }),
    onSuccess: invalidate,
  });
}

export function useVoidSubscriptionPayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => subscriptionPaymentsService.void(id, reason),
    onSuccess: invalidate,
  });
}
