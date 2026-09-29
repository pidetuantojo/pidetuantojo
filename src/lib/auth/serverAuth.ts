// SOLO servidor (rutas API): identifica a quien llama a partir del token de Firebase.
import { NextResponse } from 'next/server';

import type { Permission } from '@/constants/permissions';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { can, legacyPermissions, normalizePermissions } from '@/lib/permissions/permissions';
import type { AppUser, UserRole } from '@/types';

export interface Caller {
  uid: string;
  role: UserRole;
  restaurantId?: string;
  isActive: boolean;
  // Permisos efectivos (o los de compatibilidad si el usuario aún no fue migrado)
  permissions: Permission[];
}

/** Error con código HTTP para responder directo desde la ruta. */
export class AuthError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Lee el token `Authorization: Bearer <idToken>`, lo verifica y carga el usuario de Firestore. */
export async function getCaller(request: Request): Promise<Caller> {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AuthError('No autenticado', 401);

  let uid: string;
  try {
    ({ uid } = await adminAuth.verifyIdToken(token));
  } catch {
    throw new AuthError('Sesión inválida o expirada', 401);
  }

  const snap = await adminDb.collection('users').doc(uid).get();
  const data = snap.data() as Partial<AppUser> | undefined;
  if (!data?.role || !data.isActive) throw new AuthError('Usuario sin acceso', 403);

  const permissions = data.effectivePermissions
    ? normalizePermissions(data.effectivePermissions)
    : legacyPermissions(data.role);

  return { uid, role: data.role, restaurantId: data.restaurantId, isActive: true, permissions };
}

/** Como `getCaller`, pero exige uno de los roles indicados. */
export async function requireRole(request: Request, roles: UserRole[]): Promise<Caller> {
  const caller = await getCaller(request);
  if (!roles.includes(caller.role)) throw new AuthError('Sin permiso para esta acción', 403);
  return caller;
}

/**
 * Exige un permiso (el super admin siempre pasa). Si se indica `restaurantId`, además exige que
 * quien llama pertenezca a ese restaurante.
 */
export async function requirePermission(request: Request, permission: Permission, restaurantId?: string): Promise<Caller> {
  const caller = await getCaller(request);
  if (caller.role === 'super_admin') return caller;
  if (restaurantId && caller.restaurantId !== restaurantId) {
    throw new AuthError('No perteneces a este restaurante', 403);
  }
  if (!can(caller.permissions, permission)) throw new AuthError('No tienes permiso para esta acción', 403);
  return caller;
}

// Reglas puras (sin Firebase) en userPolicy.ts; se reexportan para usarlas desde las rutas
export { canManageRestaurantTeam, canManageUser, type TargetUser } from './userPolicy';

/** Convierte cualquier error en respuesta JSON (AuthError conserva su código). */
export function errorResponse(error: unknown, fallback: string, status = 500): NextResponse {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}
