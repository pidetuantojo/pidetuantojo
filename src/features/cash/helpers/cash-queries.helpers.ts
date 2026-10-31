import type { QueryClient } from '@tanstack/react-query';

/** Claves de `['cash', ...]` que no cambian por operar la caja (ajustes y activación). */
const STABLE_SEGMENTS: readonly unknown[] = ['settings', 'activation'];

/** Refresca turnos, movimientos, saldos y cierres tras una operación de caja. */
export function invalidateCashQueries(queryClient: QueryClient, restaurantId: string) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === 'cash' &&
      !STABLE_SEGMENTS.includes(queryKey[1]) &&
      (queryKey.includes(restaurantId) || restaurantId === ''),
  });
}
