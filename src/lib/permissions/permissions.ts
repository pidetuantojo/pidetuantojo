// Lógica pura de permisos (sin Firebase): se usa en cliente, servidor y tests.
// Plan: docs/plan-roles-permisos.md §3
import {
  LEGACY_EMPLOYEE_PERMISSIONS,
  PERMISSION_MODULES,
  type FeaturePermission,
  type Permission,
  type PermissionDefinition,
  type UserPermission,
} from '@/constants/permissions';
import type { UserRole } from '@/types';

type Def = PermissionDefinition & { key: Permission };

const DEFINITIONS: readonly Def[] = PERMISSION_MODULES.flatMap((m) => m.permissions as readonly Def[]);
const DEF_BY_KEY = new Map<string, Def>(DEFINITIONS.map((d) => [d.key, d]));
// Orden del catálogo: listas guardadas estables y comparables
const ORDER = new Map<string, number>(DEFINITIONS.map((d, i) => [d.key, i]));

/** Todos los permisos del catálogo, en orden. */
export const ALL_PERMISSIONS: readonly Permission[] = DEFINITIONS.map((d) => d.key);

export const FEATURE_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p): p is FeaturePermission => p.startsWith('features.')
);

export const USER_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p): p is UserPermission => !p.startsWith('features.')
);

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && DEF_BY_KEY.has(value);
}

export function isFeaturePermission(p: string): p is FeaturePermission {
  return p.startsWith('features.') && DEF_BY_KEY.has(p);
}

export function getPermissionDefinition(p: Permission): Def | undefined {
  return DEF_BY_KEY.get(p);
}

/** Ordena según el catálogo y quita duplicados. */
export function sortPermissions<T extends Permission>(perms: readonly T[] | Iterable<T>): T[] {
  return Array.from(new Set(perms)).sort((a, b) => (ORDER.get(a) ?? 0) - (ORDER.get(b) ?? 0));
}

/**
 * Agrega las dependencias (`requires`) de forma transitiva.
 * Ej: ['products.update'] → ['products.view', 'products.update', 'categories.view'].
 */
export function expandRequires(perms: readonly Permission[] | Iterable<Permission>): Permission[] {
  const result = new Set<Permission>();
  const visit = (p: Permission) => {
    if (result.has(p)) return;
    result.add(p);
    for (const dep of DEF_BY_KEY.get(p)?.requires ?? []) {
      if (isPermission(dep)) visit(dep);
    }
  };
  Array.from(perms).forEach(visit);
  return sortPermissions(result);
}

/** Descarta claves desconocidas (ej. permisos eliminados del catálogo), expande dependencias y ordena. */
export function normalizePermissions(values: readonly unknown[] | undefined | null): Permission[] {
  return expandRequires((values ?? []).filter(isPermission));
}

/**
 * Quita los permisos cuyas dependencias no están disponibles.
 * Ej: si el plan no tiene `features.printing`, `orders.print` no puede quedar.
 */
export function dropUnsatisfied(perms: readonly Permission[] | Iterable<Permission>): Permission[] {
  let current = new Set(Array.from(perms));
  // Iterar hasta estabilizar (una baja puede invalidar a otra)
  for (;;) {
    const next = new Set(
      Array.from(current).filter((p) => (DEF_BY_KEY.get(p)?.requires ?? []).every((dep) => current.has(dep as Permission)))
    );
    if (next.size === current.size) return sortPermissions(next);
    current = next;
  }
}

export function can(perms: readonly string[] | null | undefined, permission: Permission): boolean {
  return !!perms && perms.includes(permission);
}

export function canAny(perms: readonly string[] | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(perms, p));
}

export function canAll(perms: readonly string[] | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => can(perms, p));
}

/** Permisos de `requested` que NO están en `allowed`. */
export function missingFrom(requested: readonly Permission[], allowed: readonly string[]): Permission[] {
  const set = new Set(allowed);
  return requested.filter((p) => !set.has(p));
}

// ─── Roles ───────────────────────────────────────────────────────────────────

/** `restaurant_view` es el nombre anterior de `restaurant_employee` (se acepta hasta migrar). */
export function isEmployeeRole(role: UserRole | string | undefined): boolean {
  return role === 'restaurant_employee' || role === 'restaurant_view';
}

export function isRestaurantRole(role: UserRole | string | undefined): boolean {
  return role === 'restaurant_admin' || isEmployeeRole(role);
}

// ─── Permisos efectivos ──────────────────────────────────────────────────────

export interface EffectivePermissionsInput {
  role: UserRole;
  /**
   * Permisos del plan del restaurante. `null` = restaurante sin plan asignado (creado antes de
   * este sistema): se trata como plan completo para no quitarle funciones hasta migrar.
   */
  planPermissions: readonly unknown[] | null;
  // Solo empleados
  grantedPermissions?: readonly unknown[] | null;
  // Solo empleados: "todos los permisos del plan" (sigue al plan si este cambia)
  fullAccess?: boolean;
}

/**
 * Permisos efectivos de un usuario (lo que leen la UI y las reglas de Firestore).
 * - super_admin: todos.
 * - restaurant_admin: todos los del plan.
 * - empleado: (otorgados ∩ permisos de usuario del plan) + funcionalidades del plan.
 *   Las funcionalidades (`features.*`) se incluyen para que la UI pueda preguntar `can('features.x')`.
 */
export function computeEffectivePermissions({
  role, planPermissions, grantedPermissions, fullAccess,
}: EffectivePermissionsInput): Permission[] {
  if (role === 'super_admin') return [...ALL_PERMISSIONS];

  const plan = planPermissions === null ? [...ALL_PERMISSIONS] : dropUnsatisfied(normalizePermissions(planPermissions));
  if (role === 'restaurant_admin') return plan;
  if (!isEmployeeRole(role)) return [];

  const planSet = new Set<string>(plan);
  const features = plan.filter((p) => isFeaturePermission(p));
  const granted = fullAccess
    ? plan.filter((p) => !isFeaturePermission(p))
    : normalizePermissions(grantedPermissions).filter((p) => !isFeaturePermission(p) && planSet.has(p));

  return dropUnsatisfied([...features, ...granted]);
}

/** Permisos por defecto cuando el usuario aún no tiene `effectivePermissions` (antes de migrar). */
export function legacyPermissions(role: UserRole | undefined): Permission[] {
  if (role === 'super_admin' || role === 'restaurant_admin') return [...ALL_PERMISSIONS];
  if (isEmployeeRole(role)) return expandRequires(LEGACY_EMPLOYEE_PERMISSIONS);
  return [];
}

/**
 * Permisos que se le pueden dar a un empleado: los de usuario que tiene quien otorga
 * y que además incluye el plan del restaurante. Nadie otorga lo que no tiene.
 */
export function grantablePermissions(granterEffective: readonly string[], planPermissions: readonly Permission[] | null): UserPermission[] {
  const plan = new Set<string>(planPermissions ?? ALL_PERMISSIONS);
  const granter = new Set(granterEffective);
  return USER_PERMISSIONS.filter((p) => granter.has(p) && plan.has(p));
}

/**
 * Valida una asignación de permisos a un empleado. Devuelve los permisos no permitidos
 * (vacío = válida). Se validan ya expandidos: pedir `products.update` implica `categories.view`.
 */
export function validateGrant(
  requested: readonly unknown[],
  granterEffective: readonly string[],
  planPermissions: readonly Permission[] | null
): Permission[] {
  const allowed = new Set<string>(grantablePermissions(granterEffective, planPermissions));
  return normalizePermissions(requested).filter((p) => !isFeaturePermission(p) && !allowed.has(p));
}

// ─── Edición (editor de permisos de planes y empleados) ──────────────────────

/** Permisos que dependen (directa o indirectamente) de `perm`. */
export function dependentsOf(perm: Permission): Permission[] {
  const result = new Set<Permission>();
  const visit = (p: Permission) => {
    DEFINITIONS.forEach((d) => {
      if ((d.requires ?? []).includes(p) && !result.has(d.key)) {
        result.add(d.key);
        visit(d.key);
      }
    });
  };
  visit(perm);
  return sortPermissions(result);
}

/**
 * Marca o desmarca un permiso respetando dependencias:
 * - marcar: agrega el permiso y lo que requiere (si todo está en `available`; si no, no cambia).
 * - desmarcar: quita el permiso y todo lo que depende de él.
 */
export function togglePermission(
  current: readonly Permission[],
  perm: Permission,
  checked: boolean,
  available: readonly Permission[] = ALL_PERMISSIONS
): Permission[] {
  if (checked) {
    const needed = expandRequires([perm]);
    const availableSet = new Set(available);
    if (!needed.every((p) => availableSet.has(p))) return sortPermissions(current);
    return sortPermissions([...current, ...needed]);
  }
  const remove = new Set<Permission>([perm, ...dependentsOf(perm)]);
  return sortPermissions(current.filter((p) => !remove.has(p)));
}

/** true si se puede marcar `perm` con lo disponible (sus dependencias también están disponibles). */
export function isSelectable(perm: Permission, available: readonly Permission[]): boolean {
  const availableSet = new Set(available);
  return expandRequires([perm]).every((p) => availableSet.has(p));
}

// ─── Rutas ───────────────────────────────────────────────────────────────────

/**
 * Permiso requerido por cada ruta del dashboard. Se evalúa la ruta más específica primero.
 * - `path` que termina en `/`: solo subrutas (ej. /productos/[id]).
 * - `exact`: solo esa ruta (la raíz /dashboard no debe cubrir subrutas nuevas o redirecciones).
 * Las rutas que no aparecen aquí no requieren permiso (solo sesión).
 */
export const ROUTE_PERMISSIONS: readonly { path: string; permission: Permission; exact?: boolean }[] = [
  { path: '/dashboard/productos/nuevo', permission: 'products.create' },
  { path: '/dashboard/productos/', permission: 'products.update' }, // /productos/[id]
  { path: '/dashboard/productos', permission: 'products.view' },
  { path: '/dashboard/pedidos', permission: 'orders.view' },
  { path: '/dashboard/estados', permission: 'order_statuses.view' },
  { path: '/dashboard/categorias', permission: 'categories.view' },
  { path: '/dashboard/adicionales', permission: 'addons.view' },
  { path: '/dashboard/contabilidad', permission: 'accounting.view' },
  { path: '/dashboard/pagos', permission: 'payment_methods.view' },
  { path: '/dashboard/entrega', permission: 'delivery_methods.view' },
  { path: '/dashboard/domicilios/domiciliarios', permission: 'drivers.view' },
  { path: '/dashboard/domicilios/zonas', permission: 'delivery_zones.view' },
  { path: '/dashboard/configuracion/impresoras', permission: 'printers.view' },
  { path: '/dashboard/configuracion', permission: 'settings.view' },
  { path: '/dashboard/estacion-impresion', permission: 'print_station.run' },
  { path: '/dashboard/equipo', permission: 'team.view' },
  { path: '/dashboard', permission: 'dashboard.view', exact: true },
];

/** Permiso que exige una ruta (o null si solo requiere sesión). */
export function requiredPermissionForPath(pathname: string): Permission | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  const matches = ({ path: p, exact }: (typeof ROUTE_PERMISSIONS)[number]) => {
    if (exact) return path === p;
    if (p.endsWith('/')) return path.startsWith(p) && path.length > p.length;
    return path === p || path.startsWith(`${p}/`);
  };
  const match = ROUTE_PERMISSIONS
    .filter(matches)
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.permission ?? null;
}

export function canAccessPath(perms: readonly string[], pathname: string): boolean {
  const required = requiredPermissionForPath(pathname);
  return !required || can(perms, required);
}

// Orden de preferencia para decidir a dónde mandar al usuario al entrar o si no tiene acceso
const LANDING_ROUTES: readonly { path: string; permission: Permission }[] = [
  { path: '/dashboard', permission: 'dashboard.view' },
  { path: '/dashboard/pedidos', permission: 'orders.view' },
  { path: '/dashboard/estacion-impresion', permission: 'print_station.run' },
  ...PERMISSION_MODULES
    .filter((m): m is Extract<(typeof PERMISSION_MODULES)[number], { route: string }> => 'route' in m)
    .map((m) => ({ path: m.route, permission: m.permissions[0].key as Permission })),
];

/** Primera ruta a la que el usuario tiene acceso (o null si no tiene ninguna). */
export function firstAllowedRoute(perms: readonly string[]): string | null {
  return LANDING_ROUTES.find((r) => can(perms, r.permission))?.path ?? null;
}
