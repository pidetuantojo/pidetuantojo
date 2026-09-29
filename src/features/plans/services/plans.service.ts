import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

import { authFetch } from '@/lib/auth/authFetch';
import { db } from '@/lib/firebase/config';
import { normalizePermissions } from '@/lib/permissions/permissions';
import type { Plan, SavePlanData } from '@/types';

const plansRef = () => collection(db, 'plans');

export interface MigrationReport {
  ok: boolean;
  executed: boolean;
  restaurants: number;
  users: number;
  createFullPlan: boolean;
  restaurantsToAssign: { id: string; name?: string }[];
  usersToConvert: { uid: string; email?: string }[];
  usersPendingSync: number;
  warnings: string[];
  syncedRestaurants?: number;
  syncedUsers?: number;
  syncErrors?: string[];
}

/** Guarda los permisos normalizados (con dependencias y en orden del catálogo). */
function clean(data: SavePlanData): SavePlanData {
  return {
    ...data,
    name: data.name.trim(),
    description: data.description.trim(),
    permissions: normalizePermissions(data.permissions),
    ...(data.limits?.maxEmployees ? { limits: { maxEmployees: data.limits.maxEmployees } } : { limits: {} }),
  };
}

export const plansService = {
  async getAll(): Promise<Plan[]> {
    const snap = await getDocs(plansRef());
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id }) as Plan)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price);
  },

  async getById(id: string): Promise<Plan | null> {
    const snap = await getDoc(doc(plansRef(), id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as Plan) : null;
  },

  async create(data: SavePlanData): Promise<string> {
    const ref = doc(plansRef());
    const now = new Date().toISOString();
    await setDoc(ref, { ...clean(data), id: ref.id, createdAt: now, updatedAt: now });
    return ref.id;
  },

  async update(id: string, data: SavePlanData): Promise<void> {
    await updateDoc(doc(plansRef(), id), { ...clean(data), updatedAt: new Date().toISOString() });
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(plansRef(), id), { isActive, updatedAt: new Date().toISOString() });
  },

  /** Cuántos restaurantes usan el plan (no se puede borrar un plan en uso). */
  async countRestaurants(planId: string): Promise<number> {
    const snap = await getDocs(query(collection(db, 'restaurants'), where('planId', '==', planId), limit(500)));
    return snap.size;
  },

  async delete(id: string): Promise<void> {
    if ((await this.countRestaurants(id)) > 0) {
      throw new Error('No se puede eliminar un plan que tienen restaurantes. Cámbiales el plan primero.');
    }
    await deleteDoc(doc(plansRef(), id));
  },

  /** Recalcula permisos de usuarios afectados (servidor). */
  async sync(target: { planId: string } | { restaurantId: string }): Promise<{ restaurants: number; users: number }> {
    const res = await authFetch('/api/admin/permissions/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(target),
    });
    const data = (await res.json()) as { restaurants?: number; users?: number; error?: string };
    if (!res.ok) throw new Error(data.error ?? 'No se pudieron sincronizar los permisos');
    return { restaurants: data.restaurants ?? 0, users: data.users ?? 0 };
  },

  /** Migración al sistema de permisos: sin `execute` solo simula (no escribe nada). */
  async migrate(execute: boolean): Promise<MigrationReport> {
    const res = await authFetch('/api/admin/permissions/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ execute }),
    });
    const data = (await res.json()) as MigrationReport & { error?: string };
    if (!res.ok) throw new Error(data.error ?? 'No se pudo ejecutar la migración');
    return data;
  },
};
