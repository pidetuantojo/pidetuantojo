import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { Product, CreateProductData, UpdateProductData } from '@/types';

function productsRef(restaurantId: string) {
  return collection(db, 'restaurants', restaurantId, 'products');
}

export const productsService = {
  async getById(restaurantId: string, id: string): Promise<Product | null> {
    const snap = await getDoc(doc(productsRef(restaurantId), id));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as Product;
  },

  async getAll(restaurantId: string): Promise<Product[]> {
    const q = query(productsRef(restaurantId), orderBy('sortOrder', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Product);
  },

  async getByCategory(restaurantId: string, categoryId: string): Promise<Product[]> {
    const q = query(
      productsRef(restaurantId),
      where('categoryId', '==', categoryId),
      orderBy('sortOrder', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Product);
  },

  async create(data: CreateProductData): Promise<string> {
    const now = new Date().toISOString();
    const ref = await addDoc(productsRef(data.restaurantId), {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    await updateDoc(ref, { id: ref.id });
    return ref.id;
  },

  async update(restaurantId: string, id: string, data: UpdateProductData): Promise<void> {
    await updateDoc(doc(productsRef(restaurantId), id), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  async toggleAvailable(restaurantId: string, id: string, isAvailable: boolean): Promise<void> {
    await updateDoc(doc(productsRef(restaurantId), id), {
      isAvailable,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(restaurantId: string, id: string): Promise<void> {
    await deleteDoc(doc(productsRef(restaurantId), id));
  },

  /** Crea múltiples productos en lotes de 450 (límite Firestore: 500). */
  async createMany(
    restaurantId: string,
    products: Omit<import('@/types').CreateProductData, 'restaurantId'>[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<number> {
    const BATCH_SIZE = 450;
    const now = new Date().toISOString();
    const ref = productsRef(restaurantId);
    let created = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const chunk = products.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const p of chunk) {
        const d = doc(ref);
        batch.set(d, { ...p, restaurantId, id: d.id, createdAt: now, updatedAt: now });
      }
      await batch.commit();
      created += chunk.length;
      onProgress?.(created, products.length);
    }
    return created;
  },
};
