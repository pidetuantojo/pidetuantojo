// SOLO servidor: autorización común de las rutas /api/ledger (permiso + restaurante + plan).
import type { Permission } from '@/constants/permissions';
import { AuthError, requirePermission, type Caller } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';
import type { Restaurant } from '@/types';

export interface LedgerAccess {
  caller: Caller;
  restaurantId: string;
}

/**
 * El restaurante debe tener `features.cash` en su plan. Gate ESTRICTO: sin `planFeatures` (restaurante
 * anterior al sistema de planes) NO pasa; el super admin sí.
 */
export async function assertCashFeature(
  restaurantId: string,
  role?: Caller['role']
): Promise<void> {
  const snap = await adminDb.collection('restaurants').doc(restaurantId).get();
  if (!snap.exists) throw new AuthError('Restaurante no encontrado', 404);
  if (role === 'super_admin') return;
  const { planFeatures } = snap.data() as Pick<Restaurant, 'planFeatures'>;
  if (!planFeatures?.includes('features.cash')) {
    throw new AuthError('Tu plan no incluye caja y libro contable', 403);
  }
}

/**
 * Exige el permiso, resuelve el restaurante (el super admin puede indicar `?restaurantId=`)
 * y verifica que el plan incluya `features.cash`.
 */
export async function requireLedgerAccess(
  request: Request,
  permission: Permission
): Promise<LedgerAccess> {
  const caller = await requirePermission(request, permission);
  const requested = new URL(request.url).searchParams.get('restaurantId');
  const restaurantId =
    caller.role === 'super_admin' ? (requested ?? caller.restaurantId) : caller.restaurantId;
  if (!restaurantId) throw new AuthError('restaurantId requerido', 400);
  await assertCashFeature(restaurantId, caller.role);
  return { caller, restaurantId };
}
