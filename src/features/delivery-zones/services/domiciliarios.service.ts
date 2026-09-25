import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  orderBy,
  query,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { Domiciliario, CreateDomiciliarioData, UpdateDomiciliarioData } from '@/types';

function ref(restaurantId: string) {
  return collection(db, 'restaurants', restaurantId, 'domiciliarios');
}

export const domiciliariosService = {
  async getAll(restaurantId: string): Promise<Domiciliario[]> {
    const q = query(ref(restaurantId), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Domiciliario);
  },

  async create(data: CreateDomiciliarioData): Promise<Domiciliario> {
    const now = new Date().toISOString();
    const docRef = await addDoc(ref(data.restaurantId), { ...data, createdAt: now, updatedAt: now });
    await updateDoc(docRef, { id: docRef.id });
    return { ...data, id: docRef.id, createdAt: now, updatedAt: now };
  },

  async update(restaurantId: string, id: string, data: UpdateDomiciliarioData): Promise<void> {
    // `undefined` = borrar el campo (ej: el código al pasar a empresa); Firestore no acepta undefined
    const payload = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
    );
    await updateDoc(doc(ref(restaurantId), id), { ...payload, updatedAt: new Date().toISOString() });
  },

  async delete(restaurantId: string, id: string): Promise<void> {
    await deleteDoc(doc(ref(restaurantId), id));
  },
};
