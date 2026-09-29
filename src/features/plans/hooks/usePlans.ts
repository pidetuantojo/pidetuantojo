import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import type { SavePlanData } from '@/types';

import { plansService } from '../services/plans.service';

export function usePlans() {
  return useQuery({ queryKey: QUERY_KEYS.plans, queryFn: () => plansService.getAll(), staleTime: 60_000 });
}

export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.plan(id ?? ''),
    queryFn: () => plansService.getById(id!),
    enabled: !!id,
  });
}

/** Guarda el plan y recalcula los permisos de los restaurantes que lo usan. */
export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: SavePlanData }) => {
      const planId = id ?? (await plansService.create(data));
      if (id) await plansService.update(id, data);
      const synced = id ? await plansService.sync({ planId }) : { restaurants: 0, users: 0 };
      return { planId, synced };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.plans });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.restaurants });
    },
  });
}

export function useSetPlanActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => plansService.setActive(id, isActive),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QUERY_KEYS.plans }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plansService.delete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QUERY_KEYS.plans }),
  });
}
