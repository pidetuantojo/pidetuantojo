import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, requireRole } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';
import { FULL_PLAN_ID, buildFullPlan, planMigration, type MigrationUser } from '@/lib/permissions/migration';
import { syncRestaurantPermissions } from '@/lib/permissions/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Recorre todos los restaurantes: puede tardar más que el límite por defecto
export const maxDuration = 300;

const BATCH_LIMIT = 450;

/**
 * Migración al sistema de planes y permisos (solo super admin).
 * - POST {}                 → simulación: devuelve qué cambiaría, sin escribir nada.
 * - POST { execute: true }  → aplica: crea el plan "Completo" si hace falta, se lo asigna a los
 *   restaurantes sin plan, convierte restaurant_view → restaurant_employee (con sus permisos de
 *   siempre) y recalcula planFeatures y permisos efectivos de todos. Es idempotente.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole(request, ['super_admin']);
    const body = (await request.json().catch(() => ({}))) as { execute?: unknown };
    const execute = body.execute === true;

    const [restaurantsSnap, usersSnap, fullPlanSnap] = await Promise.all([
      adminDb.collection('restaurants').get(),
      adminDb.collection('users').get(),
      adminDb.collection('plans').doc(FULL_PLAN_ID).get(),
    ]);

    const plan = planMigration({
      restaurants: restaurantsSnap.docs.map((d) => ({ id: d.id, name: d.get('name'), planId: d.get('planId') })),
      users: usersSnap.docs.map((d) => ({ ...(d.data() as Omit<MigrationUser, 'uid'>), uid: d.id })),
      fullPlanExists: fullPlanSnap.exists,
    });

    const summary = {
      restaurants: restaurantsSnap.size,
      users: usersSnap.size,
      createFullPlan: plan.createFullPlan,
      restaurantsToAssign: plan.restaurantsToAssign,
      usersToConvert: plan.usersToConvert.map(({ uid, email }) => ({ uid, email })),
      usersPendingSync: plan.usersPendingSync,
      warnings: plan.warnings,
    };

    if (!execute) return NextResponse.json({ ok: true, executed: false, ...summary });

    const now = new Date().toISOString();

    if (plan.createFullPlan) {
      await adminDb.collection('plans').doc(FULL_PLAN_ID).set(buildFullPlan(now));
    }

    const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [
      ...plan.restaurantsToAssign.map((r) => (b: FirebaseFirestore.WriteBatch) =>
        b.update(adminDb.collection('restaurants').doc(r.id), { planId: FULL_PLAN_ID, planAssignedAt: now, updatedAt: now })
      ),
      ...plan.usersToConvert.map((u) => (b: FirebaseFirestore.WriteBatch) =>
        b.update(adminDb.collection('users').doc(u.uid), {
          role: 'restaurant_employee',
          fullAccess: false,
          ...(u.grantedPermissions ? { grantedPermissions: u.grantedPermissions } : {}),
          updatedAt: now,
        })
      ),
    ];
    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
      const batch = adminDb.batch();
      writes.slice(i, i + BATCH_LIMIT).forEach((w) => w(batch));
      await batch.commit();
    }

    // Recalcular después de asignar planes y convertir roles
    let syncedUsers = 0;
    const syncErrors: string[] = [];
    for (const restaurantId of plan.restaurantsToSync) {
      try {
        syncedUsers += await syncRestaurantPermissions(restaurantId);
      } catch (error) {
        syncErrors.push(`${restaurantId}: ${error instanceof Error ? error.message : 'error al sincronizar'}`);
      }
    }

    return NextResponse.json({
      ok: syncErrors.length === 0,
      executed: true,
      ...summary,
      syncedRestaurants: plan.restaurantsToSync.length - syncErrors.length,
      syncedUsers,
      syncErrors,
    });
  } catch (error) {
    return errorResponse(error, 'Error en la migración de permisos');
  }
}
