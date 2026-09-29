import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { teamService, type CreateMemberData, type UpdateMemberData } from '../services/team.service';

const key = (restaurantId: string) => ['team', restaurantId] as const;

export function useTeam(restaurantId: string | undefined) {
  return useQuery({
    queryKey: key(restaurantId ?? ''),
    queryFn: () => teamService.get(restaurantId!),
    enabled: !!restaurantId,
  });
}

export function useTeamMutations(restaurantId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: key(restaurantId) });
  return {
    create: useMutation({ mutationFn: (d: CreateMemberData) => teamService.create(d), onSuccess: refresh }),
    update: useMutation({ mutationFn: (d: UpdateMemberData) => teamService.update(d), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (uid: string) => teamService.remove(uid), onSuccess: refresh }),
  };
}
