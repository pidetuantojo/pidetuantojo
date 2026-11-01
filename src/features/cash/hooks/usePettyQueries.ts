import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

import { cashApi } from '../services/cash.api';
import type { PettyExpenseStatus } from '../types/cash.petty.types';

/** Fondo, efectivo, vales pendientes e invariante de una caja menor. */
export function usePettyStatus(
  restaurantId: string | undefined,
  registerId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: QUERY_KEYS.cashPettyStatus(restaurantId ?? '', registerId ?? ''),
    queryFn: () => cashApi.getPettyStatus(registerId ?? ''),
    enabled: enabled && !!restaurantId && !!registerId,
    staleTime: 1000 * 10,
  });
}

export function usePettyExpenses(
  restaurantId: string | undefined,
  registerId: string | undefined,
  status: PettyExpenseStatus | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: QUERY_KEYS.cashPettyExpenses(restaurantId ?? '', registerId ?? '', status ?? 'ALL'),
    queryFn: () => cashApi.listPettyExpenses(registerId ?? '', status),
    enabled: enabled && !!restaurantId && !!registerId,
    staleTime: 1000 * 10,
  });
}

export function usePettyReimbursements(
  restaurantId: string | undefined,
  registerId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: QUERY_KEYS.cashPettyReimbursements(restaurantId ?? '', registerId ?? ''),
    queryFn: () => cashApi.listPettyReimbursements(registerId ?? ''),
    enabled: enabled && !!restaurantId && !!registerId,
    staleTime: 1000 * 10,
  });
}

export function usePettyCategories(restaurantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.cashPettyCategories(restaurantId ?? ''),
    queryFn: () => cashApi.listPettyCategories(),
    enabled: enabled && !!restaurantId,
    staleTime: 1000 * 60,
  });
}
