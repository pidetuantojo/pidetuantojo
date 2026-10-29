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
import type { Category, CreateCategoryData, UpdateCategoryData } from '@/types';

function categoriesRef(restaurantId: string) {
  return collection(db, 'restaurants', restaurantId, 'categories');
}

export const categoriesService = {
  async getAll(restaurantId: string): Promise<Category[]> {
    const q = query(categoriesRef(restaurantId), orderBy('sortOrder', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Category);
  },

  async create(data: CreateCategoryData): Promise<string> {
    const now = new Date().toISOString();
    const ref = await addDoc(categoriesRef(data.restaurantId), {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    await updateDoc(ref, { id: ref.id });
    return ref.id;
  },

  async update(restaurantId: string, id: string, data: UpdateCategoryData): Promise<void> {
    await updateDoc(doc(categoriesRef(restaurantId), id), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  async toggleActive(restaurantId: string, id: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(categoriesRef(restaurantId), id), {
      isActive,
      updatedAt: new Date().toISOString(),
    });
  },

  /** Falla si la categoría tiene productos: quedarían huérfanos y desaparecerían del menú. */
  async delete(restaurantId: string, id: string): Promise<void> {
    const productsRef = collection(db, 'restaurants', restaurantId, 'products');
    const inUse = !(await getDocs(query(productsRef, where('categoryId', '==', id), limit(1)))).empty;
    if (inUse) {
      throw new Error('Esta categoría tiene productos. Muévelos a otra categoría o elimínalos antes de borrarla.');
    }
    await deleteDoc(doc(categoriesRef(restaurantId), id));
  },
};
