'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { invalidatePublicMenu, publicMenuRestaurant } from '@/lib/menu/invalidatePublicMenu';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Las mutaciones con `publicMenuMeta` (productos, categorías, promociones…) vacían la caché de la carta
        mutationCache: new MutationCache({
          onSuccess: (_data, variables, _context, mutation) => {
            invalidatePublicMenu(publicMenuRestaurant(mutation.options.meta, variables));
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
