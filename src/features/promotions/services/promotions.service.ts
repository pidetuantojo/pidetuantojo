import {
  collection, deleteDoc, deleteField, doc, getDocs, orderBy, query, setDoc, updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { Promotion, SavePromotionData } from '@/types';

function promotionsRef(restaurantId: string) {
  return collection(db, 'restaurants', restaurantId, 'promotions');
}

// Firestore rechaza `undefined`: al crear se omite; al editar significa "borrar el campo"
function withoutUndefined<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// Panel del restaurante. `usesCount` lo incrementa SOLO el servidor al crear pedidos (firestore.rules).
export const promotionsService = {
  async getAll(restaurantId: string): Promise<Promotion[]> {
    const snap = await getDocs(query(promotionsRef(restaurantId), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Promotion);
  },

  async create(restaurantId: string, data: SavePromotionData): Promise<Promotion> {
    const now = new Date().toISOString();
    const ref = doc(promotionsRef(restaurantId));
    const promotion: Promotion = { ...data, id: ref.id, restaurantId, usesCount: 0, createdAt: now, updatedAt: now };
    await setDoc(ref, withoutUndefined(promotion));
    return promotion;
  },

  async update(restaurantId: string, id: string, data: Partial<SavePromotionData>): Promise<void> {
    const payload = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === undefined ? deleteField() : v])
    );
    await updateDoc(doc(promotionsRef(restaurantId), id), { ...payload, updatedAt: new Date().toISOString() });
  },

  async delete(restaurantId: string, id: string): Promise<void> {
    await deleteDoc(doc(promotionsRef(restaurantId), id));
  },
};
