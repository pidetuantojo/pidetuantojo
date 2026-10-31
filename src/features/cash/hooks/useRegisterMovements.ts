import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase/config';

import type { MovementRow } from '../types/cash.types';

/**
 * Últimos movimientos de una caja (en vivo). Solo `cash.approve` puede leer `cashMovements` sin
 * filtrar por cajero. Requiere el índice compuesto registerId + createdAt (firestore.indexes.json).
 */
export function useRegisterMovements(
  restaurantId: string | undefined,
  registerId: string | undefined,
  max = 50
) {
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!restaurantId || !registerId) {
      setMovements([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    const q = query(
      collection(db, 'restaurants', restaurantId, 'cashMovements'),
      where('registerId', '==', registerId),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    return onSnapshot(
      q,
      (snap) => {
        setMovements(snap.docs.map((d) => ({ ...(d.data() as MovementRow), id: d.id })));
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );
  }, [restaurantId, registerId, max]);

  return { movements, isLoading, error };
}
