// SOLO servidor: autorización de las rutas /api/cash/petty (permiso + restaurante + plan).
import type { Permission } from '@/constants/permissions';
import { AuthError } from '@/lib/auth/serverAuth';

import { requireCashAccess, type CashAccess } from '../access.server';

/**
 * Exige AL MENOS uno de los permisos. Un 401 (sin sesión) corta de inmediato; un 403 prueba con
 * el siguiente permiso y, si ninguno alcanza, devuelve el último rechazo.
 */
export async function requirePettyAccess(
  request: Request,
  anyOf: readonly Permission[]
): Promise<CashAccess> {
  let lastError: unknown;
  for (const permission of anyOf) {
    try {
      return await requireCashAccess(request, permission);
    } catch (error) {
      if (!(error instanceof AuthError) || error.status !== 403) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export const PETTY_VIEW_PERMISSIONS: readonly Permission[] = [
  'petty_cash.manage',
  'petty_cash.approve',
];
