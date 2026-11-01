import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

import { ledgerApi } from '../services/ledger.api';

export { useLedgerAccounts } from '@/features/cash/hooks/useCashQueries';

export function useLedgerRules(restaurantId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.ledgerRules(restaurantId ?? ''),
    queryFn: () => ledgerApi.listRules(),
    enabled: !!restaurantId,
    staleTime: 1000 * 60,
    retry: false,
  });
}

/** Libro diario paginado con cursor: cada página trae hasta 50 asientos. */
export function useJournal(restaurantId: string | undefined, from: string, to: string) {
  return useInfiniteQuery({
    queryKey: QUERY_KEYS.ledgerJournal(restaurantId ?? '', from, to),
    queryFn: ({ pageParam }) => ledgerApi.getJournal(from, to, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!restaurantId,
    staleTime: 1000 * 30,
    retry: false,
  });
}

export function useLedgerBook(
  restaurantId: string | undefined,
  accountId: string,
  from: string,
  to: string
) {
  return useQuery({
    queryKey: QUERY_KEYS.ledgerBook(restaurantId ?? '', accountId, from, to),
    queryFn: () => ledgerApi.getLedger(accountId, from, to),
    enabled: !!restaurantId && !!accountId,
    staleTime: 1000 * 30,
    retry: false,
  });
}

export function useTrialBalance(restaurantId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: QUERY_KEYS.ledgerTrialBalance(restaurantId ?? '', from, to),
    queryFn: () => ledgerApi.getTrialBalance(from, to),
    enabled: !!restaurantId,
    staleTime: 1000 * 30,
    retry: false,
  });
}
