import { collection, getDocs, query, where } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { db } from '@/lib/firebase/config';

/**
 * ¿El cajero tiene un cierre enviado que espera aprobación? `/shifts/current` devuelve `null` en
 * ese caso, así que se consulta su propio turno (las reglas permiten leer los turnos propios).
 */
export function useOwnPendingClose(
  restaurantId: string | undefined,
  uid: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: QUERY_KEYS.cashOwnPendingClose(restaurantId ?? '', uid ?? ''),
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(db, 'restaurants', restaurantId ?? '', 'cashShifts'),
          where('cashierUid', '==', uid ?? ''),
          where('status', '==', 'CERRADO_PENDIENTE_APROBACION')
        )
      );
      return !snap.empty;
    },
    enabled: enabled && !!restaurantId && !!uid,
    staleTime: 1000 * 15,
    retry: false,
  });
}
