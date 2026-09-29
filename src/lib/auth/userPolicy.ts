// Reglas puras de administración de usuarios (sin Firebase: se testean directo).
import { can, isEmployeeRole, legacyPermissions } from '@/lib/permissions/permissions';
import type { UserRole } from '@/types';

export interface PolicyCaller {
  uid?: string;
  role: UserRole;
  restaurantId?: string;
  // Permisos efectivos de quien actúa (requeridos para empleados con permisos de equipo)
  permissions?: readonly string[];
}

/** Datos mínimos del usuario sobre el que se actúa. */
export interface TargetUser {
  uid?: string;
  role?: UserRole;
  restaurantId?: string;
  effectivePermissions?: readonly string[];
}

/** Permisos del objetivo (o los legados si aún no fue migrado). */
function targetPermissions(target: TargetUser): readonly string[] {
  return target.effectivePermissions ?? legacyPermissions(target.role);
}

/**
 * ¿Puede `caller` administrar (editar, cambiar contraseña, borrar) al usuario `target`?
 * - super_admin: a cualquiera.
 * - Solo se administran EMPLEADOS del MISMO restaurante; nunca a uno mismo ni a un admin.
 * - restaurant_admin: a cualquier empleado de su restaurante.
 * - empleado con permisos de equipo: solo a empleados que no tengan más permisos que él
 *   (no puede tocar a alguien con más acceso).
 */
export function canManageUser(caller: PolicyCaller, target: TargetUser): boolean {
  if (caller.role === 'super_admin') return true;
  if (!caller.restaurantId || target.restaurantId !== caller.restaurantId) return false;
  if (!isEmployeeRole(target.role)) return false;
  if (caller.uid && target.uid && caller.uid === target.uid) return false;
  if (caller.role === 'restaurant_admin') return true;
  if (!isEmployeeRole(caller.role)) return false;
  const mine = new Set(caller.permissions ?? []);
  return targetPermissions(target).every((p) => mine.has(p));
}

/** ¿Puede ver/crear usuarios del restaurante `restaurantId`? (requiere `team.view`) */
export function canManageRestaurantTeam(caller: PolicyCaller, restaurantId: string): boolean {
  if (caller.role === 'super_admin') return true;
  if (!caller.restaurantId || caller.restaurantId !== restaurantId) return false;
  if (caller.role === 'restaurant_admin' && !caller.permissions) return true; // admin legado
  return can(caller.permissions ?? [], 'team.view');
}
