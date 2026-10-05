import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { RestaurantCategory, SaveRestaurantCategoryData } from '@/types';

const colRef = () => collection(db, 'restaurantCategories');

function clean(data: SaveRestaurantCategoryData): SaveRestaurantCategoryData {
  return {
    ...data,
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase(),
    ...(data.icon ? { icon: data.icon.trim() } : {}),
  };
}

export const restaurantCategoriesService = {
  async getAll(): Promise<RestaurantCategory[]> {
    const snap = await getDocs(query(colRef(), orderBy('sortOrder', 'asc')));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as RestaurantCategory);
  },

  async getById(id: string): Promise<RestaurantCategory | null> {
    const snap = await getDoc(doc(colRef(), id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as RestaurantCategory) : null;
  },

  async create(data: SaveRestaurantCategoryData): Promise<string> {
    const ref = doc(colRef());
    const now = new Date().toISOString();
    await setDoc(ref, { ...clean(data), id: ref.id, createdAt: now, updatedAt: now });
    return ref.id;
  },

  async update(id: string, data: SaveRestaurantCategoryData): Promise<void> {
    await updateDoc(doc(colRef(), id), { ...clean(data), updatedAt: new Date().toISOString() });
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(colRef(), id), { isActive, updatedAt: new Date().toISOString() });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(colRef(), id));
  },
};
