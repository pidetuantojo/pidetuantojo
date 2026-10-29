import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { OrderStatus, CreateOrderStatusData } from '@/types';

function statusesRef(restaurantId: string) {
  return collection(db, 'restaurants', restaurantId, 'orderStatuses');
}

export const orderStatusesService = {
  async getAll(restaurantId: string): Promise<OrderStatus[]> {
    const q = query(statusesRef(restaurantId), orderBy('sortOrder', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as OrderStatus);
  },

  async create(data: CreateOrderStatusData): Promise<string> {
    const now = new Date().toISOString();
    const ref = await addDoc(statusesRef(data.restaurantId), {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    await updateDoc(ref, { id: ref.id });
    return ref.id;
  },

  async update(
    restaurantId: string,
    id: string,
    data: Partial<Pick<OrderStatus, 'name' | 'color' | 'sortOrder' | 'isActive'>>
  ): Promise<void> {
    await updateDoc(doc(statusesRef(restaurantId), id), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  async toggleActive(restaurantId: string, id: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(statusesRef(restaurantId), id), {
      isActive,
      updatedAt: new Date().toISOString(),
    });
  },

  /** Falla si algún pedido usa el estado: esos pedidos quedarían sin estado visible en el tablero. */
  async delete(restaurantId: string, id: string): Promise<void> {
    let inUse: boolean;
    try {
      const ordersRef = collection(db, 'restaurants', restaurantId, 'orders');
      inUse = !(await getDocs(query(ordersRef, where('statusId', '==', id), limit(1)))).empty;
    } catch {
      throw new Error('No se pudo verificar si hay pedidos con este estado. Desactívalo en lugar de eliminarlo.');
    }
    if (inUse) {
      throw new Error('Hay pedidos con este estado, así que no se puede eliminar. Desactívalo para que no se use más.');
    }
    await deleteDoc(doc(statusesRef(restaurantId), id));
  },
};
