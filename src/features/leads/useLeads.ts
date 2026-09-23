import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { leadsService, type RestaurantLead } from './leads.service';

export function useLeads() {
  return useQuery({
    queryKey: QUERY_KEYS.leads,
    queryFn: () => leadsService.getAll(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RestaurantLead['status'] }) =>
      leadsService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads });
    },
  });
}
