import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { Mesa, CreateMesaData, UpdateMesaData } from '@/types';

function mesasRef(restaurantId: string) {
  return collection(db, 'restaurants', restaurantId, 'mesas');
}

export const mesasService = {
  async getAll(restaurantId: string): Promise<Mesa[]> {
    const q = query(mesasRef(restaurantId), orderBy('sortOrder', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Mesa);
  },

  async create(restaurantId: string, data: CreateMesaData): Promise<Mesa> {
    const now = new Date().toISOString();
    const ref = await addDoc(mesasRef(restaurantId), {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    await updateDoc(ref, { id: ref.id });
    return { ...data, id: ref.id, createdAt: now, updatedAt: now };
  },

  async update(restaurantId: string, mesaId: string, data: UpdateMesaData): Promise<void> {
    await updateDoc(doc(mesasRef(restaurantId), mesaId), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(restaurantId: string, mesaId: string): Promise<void> {
    await deleteDoc(doc(mesasRef(restaurantId), mesaId));
  },
};
