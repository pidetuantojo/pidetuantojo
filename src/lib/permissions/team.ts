// Reglas puras del equipo (empleados) — sin Firebase.
import type { Plan } from '@/types';

/** Límite histórico de usuarios de acceso (restaurantes creados antes de los planes). */
export const LEGACY_MAX_EMPLOYEES = 2;

/**
 * Máximo de empleados del restaurante, o `null` si no hay límite.
 * - Sin plan (anterior al sistema): el límite histórico (2).
 * - Con plan: `limits.maxEmployees`; si el plan no lo define, sin límite.
 */
export function employeeLimit(plan: Pick<Plan, 'limits'> | null, hasPlan: boolean): number | null {
  if (!hasPlan) return LEGACY_MAX_EMPLOYEES;
  const max = plan?.limits?.maxEmployees;
  return typeof max === 'number' && max > 0 ? max : null;
}

export function canAddEmployee(current: number, limit: number | null): boolean {
  return limit === null || current < limit;
}
