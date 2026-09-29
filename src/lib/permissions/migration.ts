// Migración al sistema de planes y permisos (Fase 7). Lógica pura: decide QUÉ cambiar;
// quien escribe en Firestore es src/app/api/admin/permissions/migrate/route.ts.
import { LEGACY_EMPLOYEE_PERMISSIONS } from '@/constants/permissions';
import type { Plan, UserRole } from '@/types';

import { ALL_PERMISSIONS, isEmployeeRole } from './permissions';

// Id fijo: correr la migración varias veces no crea planes duplicados
export const FULL_PLAN_ID = 'completo';

/** Plan con todo incluido: los restaurantes existentes conservan exactamente el acceso que tenían. */
export function buildFullPlan(now: string): Plan {
  return {
    id: FULL_PLAN_ID,
    name: 'Completo',
    description: 'Todas las funcionalidades. Asignado a los restaurantes creados antes de los planes.',
    price: 0,
    billingPeriod: 'monthly',
    permissions: [...ALL_PERMISSIONS],
    limits: {},
    isActive: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export interface MigrationRestaurant {
  id: string;
  name?: string;
  planId?: string;
}

export interface MigrationUser {
  uid: string;
  email?: string;
  role?: UserRole | string;
  restaurantId?: string;
  grantedPermissions?: string[];
  effectivePermissions?: string[];
}

export interface MigrationInput {
  restaurants: MigrationRestaurant[];
  users: MigrationUser[];
  // ¿Ya existe plans/{FULL_PLAN_ID}?
  fullPlanExists: boolean;
}

export interface UserConversion {
  uid: string;
  email?: string;
  // Solo si no tenía permisos otorgados: se le dan los mismos que tenía el rol anterior
  grantedPermissions?: string[];
}

export interface MigrationPlan {
  createFullPlan: boolean;
  // Restaurantes sin plan → plan Completo
  restaurantsToAssign: { id: string; name?: string }[];
  // restaurant_view → restaurant_employee
  usersToConvert: UserConversion[];
  // Todos los restaurantes: se recalculan planFeatures y los permisos efectivos de sus usuarios
  restaurantsToSync: string[];
  // Usuarios de restaurante que aún no tienen permisos efectivos (quedarán calculados al sincronizar)
  usersPendingSync: number;
  // Avisos que requieren revisión manual (no se modifican)
  warnings: string[];
}

export function planMigration({ restaurants, users, fullPlanExists }: MigrationInput): MigrationPlan {
  const restaurantIds = new Set(restaurants.map((r) => r.id));
  const restaurantsToAssign = restaurants
    .filter((r) => !r.planId)
    .map((r) => ({ id: r.id, ...(r.name ? { name: r.name } : {}) }));

  const warnings: string[] = [];
  const usersToConvert: UserConversion[] = [];
  let usersPendingSync = 0;

  for (const user of users) {
    if (user.role === 'super_admin') continue;
    const label = user.email ?? user.uid;

    if (user.role !== 'restaurant_admin' && !isEmployeeRole(user.role)) {
      warnings.push(`${label}: rol desconocido "${String(user.role)}" (no se modifica)`);
      continue;
    }
    if (!user.restaurantId || !restaurantIds.has(user.restaurantId)) {
      warnings.push(`${label}: sin restaurante válido (${user.restaurantId ?? 'vacío'}); no recibirá permisos`);
      continue;
    }

    if (user.role === 'restaurant_view') {
      usersToConvert.push({
        uid: user.uid,
        ...(user.email ? { email: user.email } : {}),
        ...(user.grantedPermissions ? {} : { grantedPermissions: [...LEGACY_EMPLOYEE_PERMISSIONS] }),
      });
    }
    if (!user.effectivePermissions) usersPendingSync++;
  }

  const needsPlan = restaurantsToAssign.length > 0;
  return {
    createFullPlan: needsPlan && !fullPlanExists,
    restaurantsToAssign,
    usersToConvert,
    restaurantsToSync: restaurants.map((r) => r.id),
    usersPendingSync,
    warnings,
  };
}
