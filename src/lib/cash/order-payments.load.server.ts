// SOLO servidor: lectura del pedido y del restaurante dentro de la transacción de un cobro.
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import type { Order, OrderStatus, Restaurant } from '@/types';

import { CashError } from './cash.errors';
import type { MovementContext } from './movement.context.server';

export interface LoadedOrder {
  ref: DocumentReference;
  order: Order;
  statusCode: string | undefined;
  restaurant: Pick<Restaurant, 'paymentMethods' | 'deliveryMethods'>;
}

export async function loadOrder(ctx: MovementContext, orderId: string): Promise<LoadedOrder> {
  const { tx, restaurantId } = ctx;
  const ref = adminDb.doc(`restaurants/${restaurantId}/orders/${orderId}`) as DocumentReference;
  const snap = await tx.get(ref);
  const data = snap.data() as Order | undefined;
  if (!snap.exists || !data || (data.restaurantId && data.restaurantId !== restaurantId)) {
    throw new CashError('ORDER_NOT_FOUND', 'El pedido no existe');
  }
  const order: Order = { ...data, id: snap.id };

  const [statusSnap, restaurantSnap] = await Promise.all([
    tx.get(
      adminDb.doc(
        `restaurants/${restaurantId}/orderStatuses/${order.statusId ?? '_'}`
      ) as DocumentReference
    ),
    tx.get(adminDb.doc(`restaurants/${restaurantId}`) as DocumentReference),
  ]);
  return {
    ref,
    order,
    statusCode: (statusSnap.data() as OrderStatus | undefined)?.code,
    restaurant: (restaurantSnap.data() ?? {}) as Pick<
      Restaurant,
      'paymentMethods' | 'deliveryMethods'
    >,
  };
}
