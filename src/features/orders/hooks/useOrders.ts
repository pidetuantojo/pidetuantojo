import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { Order } from '@/types';

export interface DateRange {
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

export function useOrders(restaurantId: string, dateRange: DateRange | null, refreshKey = 0) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const constraints = dateRange
      ? [
          where('createdAt', '>=', dateRange.start),
          where('createdAt', '<=', dateRange.end),
          orderBy('createdAt', 'desc'),
        ]
      : [orderBy('createdAt', 'desc')];

    const q = query(collection(db, 'restaurants', restaurantId, 'orders'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setOrders(
          snap.docs
            .map((d) => ({ ...d.data(), id: d.id }) as Order)
            .filter((o) => !o.isDeleted)
        );
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [restaurantId, dateRange?.start, dateRange?.end, refreshKey]);

  return { orders, isLoading, error };
}
