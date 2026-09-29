// SOLO servidor (rutas API / scripts): calcula y guarda permisos efectivos con Admin SDK.
// Es el ÚNICO lugar que escribe users/{uid}.effectivePermissions y restaurants/{id}.planFeatures.
import { adminDb } from '@/lib/firebase/admin';
import type { Permission } from '@/constants/permissions';
import type { AppUser, Plan, Restaurant } from '@/types';

import {
  computeEffectivePermissions,
  dropUnsatisfied,
  FEATURE_PERMISSIONS,
  isFeaturePermission,
  normalizePermissions,
} from './permissions';

// Firestore permite 500 operaciones por batch
const BATCH_LIMIT = 450;

export interface RestaurantPlanInfo {
  // null = restaurante sin plan (anterior al sistema): acceso completo
  planPermissions: Permission[] | null;
  plan: Plan | null;
}

export async function getPlan(planId: string | undefined | null): Promise<Plan | null> {
  if (!planId) return null;
  const snap = await adminDb.collection('plans').doc(planId).get();
  return snap.exists ? ({ ...snap.data(), id: snap.id } as Plan) : null;
}

/** Permisos del plan del restaurante (normalizados y con dependencias satisfechas). */
export async function getRestaurantPlan(restaurantId: string): Promise<RestaurantPlanInfo> {
  const snap = await adminDb.collection('restaurants').doc(restaurantId).get();
  const restaurant = snap.data() as Restaurant | undefined;
  const plan = await getPlan(restaurant?.planId);
  // Plan asignado pero borrado: sin permisos (no se da acceso completo por error)
  if (restaurant?.planId && !plan) return { planPermissions: [], plan: null };
  return { planPermissions: plan ? dropUnsatisfied(normalizePermissions(plan.permissions)) : null, plan };
}

/** Funcionalidades (features.*) que se copian al restaurante para que el menú público las lea. */
export function planFeatures(planPermissions: Permission[] | null): string[] {
  return planPermissions === null ? [...FEATURE_PERMISSIONS] : planPermissions.filter(isFeaturePermission);
}

function effectiveFor(user: Partial<AppUser>, planPermissions: Permission[] | null): Permission[] {
  return computeEffectivePermissions({
    role: user.role ?? 'restaurant_employee',
    planPermissions,
    grantedPermissions: user.grantedPermissions ?? null,
    fullAccess: user.fullAccess ?? false,
  });
}

/**
 * Recalcula el restaurante: copia `planFeatures`/`planName` y actualiza `effectivePermissions`
 * de todos sus usuarios. Devuelve cuántos usuarios se actualizaron.
 */
export async function syncRestaurantPermissions(restaurantId: string): Promise<number> {
  const { planPermissions, plan } = await getRestaurantPlan(restaurantId);
  const usersSnap = await adminDb.collection('users').where('restaurantId', '==', restaurantId).get();
  const now = new Date().toISOString();

  const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [
    (b) => b.update(adminDb.collection('restaurants').doc(restaurantId), {
      planFeatures: planFeatures(planPermissions),
      ...(plan ? { planName: plan.name } : {}),
    }),
    ...usersSnap.docs.map((d) => (b: FirebaseFirestore.WriteBatch) =>
      b.update(d.ref, { effectivePermissions: effectiveFor(d.data() as AppUser, planPermissions), permissionsSyncedAt: now })
    ),
  ];

  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    writes.slice(i, i + BATCH_LIMIT).forEach((w) => w(batch));
    await batch.commit();
  }
  return usersSnap.size;
}

/** Recalcula todos los restaurantes que usan un plan (al editar el plan). */
export async function syncPlanPermissions(planId: string): Promise<{ restaurants: number; users: number }> {
  const snap = await adminDb.collection('restaurants').where('planId', '==', planId).get();
  let users = 0;
  for (const doc of snap.docs) users += await syncRestaurantPermissions(doc.id);
  return { restaurants: snap.size, users };
}

/** Recalcula un solo usuario (al crearlo o cambiarle permisos). */
export async function syncUserPermissions(uid: string): Promise<Permission[]> {
  const ref = adminDb.collection('users').doc(uid);
  const user = (await ref.get()).data() as AppUser | undefined;
  if (!user) return [];
  const { planPermissions } = user.restaurantId
    ? await getRestaurantPlan(user.restaurantId)
    : { planPermissions: null };
  const effective = effectiveFor(user, planPermissions);
  await ref.update({ effectivePermissions: effective, permissionsSyncedAt: new Date().toISOString() });
  return effective;
}
