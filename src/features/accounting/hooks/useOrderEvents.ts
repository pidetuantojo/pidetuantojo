'use client';

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, orderBy, query, type Timestamp } from 'firebase/firestore';

import { QUERY_KEYS } from '@/constants/query-keys';
import { db } from '@/lib/firebase/config';
import type { OrderEvent } from '@/lib/orders/orderEvents';

async function fetchOrderEvents(restaurantId: string, orderId: string): Promise<OrderEvent[]> {
  const snap = await getDocs(query(
    collection(db, 'restaurants', restaurantId, 'orders', orderId, 'events'),
    orderBy('at', 'asc'),
  ));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<OrderEvent, 'id' | 'at'> & { at?: Timestamp };
    return { ...data, id: d.id, at: data.at?.toDate().toISOString() ?? new Date().toISOString() };
  });
}

/** Bitácora de auditoría de un pedido (solo lectura). */
export function useOrderEvents(restaurantId: string, orderId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.orderEvents(restaurantId, orderId ?? ''),
    queryFn: () => fetchOrderEvents(restaurantId, orderId!),
    enabled: !!restaurantId && !!orderId,
  });
}
