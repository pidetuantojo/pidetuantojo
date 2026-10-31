// SOLO servidor: autorización común de las rutas /api/cash (permiso + restaurante + plan).
import type { Permission } from '@/constants/permissions';
import { requireLedgerAccess, type LedgerAccess } from '@/lib/ledger/access.server';

export type CashAccess = LedgerAccess;

/**
 * Igual que `requireLedgerAccess`: exige el permiso, resuelve el restaurante (el super admin puede
 * indicar `?restaurantId=`) y verifica el gate estricto de `features.cash`.
 */
export function requireCashAccess(request: Request, permission: Permission): Promise<CashAccess> {
  return requireLedgerAccess(request, permission);
}

export function hasCallerPermission(access: CashAccess, permission: Permission): boolean {
  return access.caller.role === 'super_admin' || access.caller.permissions.includes(permission);
}
