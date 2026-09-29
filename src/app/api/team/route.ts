import { NextRequest, NextResponse } from 'next/server';

import {
  ALL_PERMISSIONS, getPermissionDefinition, grantablePermissions, isEmployeeRole, normalizePermissions, USER_PERMISSIONS, validateGrant,
} from '@/lib/permissions/permissions';
import { getRestaurantPlan, syncUserPermissions } from '@/lib/permissions/server';
import { canAddEmployee, employeeLimit } from '@/lib/permissions/team';
import { AuthError, canManageRestaurantTeam, canManageUser, errorResponse, getCaller, type Caller } from '@/lib/auth/serverAuth';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import type { Permission } from '@/constants/permissions';
import type { AppUser } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Gestión de empleados del restaurante. TODO se valida aquí (Admin SDK): el cliente nunca escribe
// roles ni permisos. Reemplaza a /api/users + setDoc/updateDoc desde el navegador.

const EMPLOYEE_ROLES = ['restaurant_employee', 'restaurant_view'] as const;

function hasPerm(caller: Caller, p: Permission) {
  return caller.role === 'super_admin' || caller.permissions.includes(p);
}

function requirePerm(caller: Caller, p: Permission) {
  if (!hasPerm(caller, p)) {
    throw new AuthError(`No tienes permiso: ${getPermissionDefinition(p)?.label ?? p}`, 403);
  }
}

/** Solo admin/super admin, o quien tenga TODOS los permisos de usuario del plan, puede dar "acceso completo". */
function canGrantFullAccess(caller: Caller, planPermissions: Permission[] | null) {
  if (caller.role === 'super_admin' || caller.role === 'restaurant_admin') return true;
  const plan = planPermissions ?? [...ALL_PERMISSIONS];
  return USER_PERMISSIONS.filter((p) => plan.includes(p)).every((p) => caller.permissions.includes(p));
}

function assertGrant(caller: Caller, requested: unknown[], planPermissions: Permission[] | null) {
  const granterPerms = caller.role === 'super_admin' ? [...ALL_PERMISSIONS] : caller.permissions;
  const invalid = validateGrant(requested, granterPerms, planPermissions);
  if (invalid.length) {
    const labels = invalid.map((p) => getPermissionDefinition(p)?.label ?? p).join(', ');
    throw new AuthError(`No puedes otorgar estos permisos: ${labels}`, 403);
  }
}

function publicUser(u: AppUser) {
  return {
    uid: u.uid, email: u.email, displayName: u.displayName, role: u.role, restaurantId: u.restaurantId,
    isActive: u.isActive, fullAccess: !!u.fullAccess,
    grantedPermissions: normalizePermissions(u.grantedPermissions ?? []),
    effectivePermissions: u.effectivePermissions ?? null,
    createdAt: u.createdAt, updatedAt: u.updatedAt,
  };
}

async function loadTarget(uid: unknown) {
  if (typeof uid !== 'string' || !uid) throw new AuthError('uid requerido', 400);
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) throw new AuthError('Usuario no encontrado', 404);
  return { ref: snap.ref, user: { ...(snap.data() as AppUser), uid } };
}

// ─── GET: empleados + contexto para el editor (qué puede otorgar quien llama) ──
export async function GET(request: NextRequest) {
  try {
    const restaurantId = request.nextUrl.searchParams.get('restaurantId') ?? '';
    const caller = await getCaller(request);
    if (!restaurantId || !canManageRestaurantTeam(caller, restaurantId)) {
      throw new AuthError('No puedes ver el equipo de este restaurante', 403);
    }
    const [{ planPermissions, plan }, snap] = await Promise.all([
      getRestaurantPlan(restaurantId),
      adminDb.collection('users').where('restaurantId', '==', restaurantId).get(),
    ]);
    const employees = snap.docs
      .map((d) => ({ ...(d.data() as AppUser), uid: d.id }))
      .filter((u) => isEmployeeRole(u.role))
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

    const granterPerms = caller.role === 'super_admin' ? [...ALL_PERMISSIONS] : caller.permissions;
    return NextResponse.json({
      employees: employees.map((u) => ({
        ...publicUser(u),
        canManage: canManageUser(caller, u),
      })),
      grantable: grantablePermissions(granterPerms, planPermissions),
      canGrantFullAccess: canGrantFullAccess(caller, planPermissions),
      limit: employeeLimit(plan, planPermissions !== null),
      planName: plan?.name ?? null,
      can: {
        create: hasPerm(caller, 'team.create'),
        update: hasPerm(caller, 'team.update'),
        resetPassword: hasPerm(caller, 'team.reset_password'),
        delete: hasPerm(caller, 'team.delete'),
      },
    });
  } catch (error) {
    return errorResponse(error, 'Error al obtener el equipo');
  }
}

// ─── POST: crear empleado ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let createdUid: string | null = null;
  try {
    const caller = await getCaller(request);
    requirePerm(caller, 'team.create');
    const body = (await request.json()) as {
      restaurantId?: string; displayName?: string; email?: string; password?: string;
      fullAccess?: boolean; grantedPermissions?: unknown[];
    };
    const restaurantId = body.restaurantId ?? '';
    if (!restaurantId || !canManageRestaurantTeam(caller, restaurantId)) {
      throw new AuthError('No puedes crear usuarios en este restaurante', 403);
    }
    const displayName = body.displayName?.trim() ?? '';
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';
    if (!displayName || !email) throw new AuthError('Nombre y correo son obligatorios', 400);
    if (password.length < 6) throw new AuthError('La contraseña debe tener al menos 6 caracteres', 400);

    const { planPermissions, plan } = await getRestaurantPlan(restaurantId);
    const fullAccess = !!body.fullAccess;
    if (fullAccess && !canGrantFullAccess(caller, planPermissions)) {
      throw new AuthError('No puedes dar acceso completo', 403);
    }
    const granted = fullAccess ? [] : normalizePermissions(body.grantedPermissions ?? []).filter((p) => !p.startsWith('features.'));
    if (!fullAccess) {
      if (granted.length === 0) throw new AuthError('Elige al menos un permiso o "Acceso completo"', 400);
      assertGrant(caller, granted, planPermissions);
    }

    // Límite de empleados del plan
    const current = (await adminDb.collection('users').where('restaurantId', '==', restaurantId).get())
      .docs.filter((d) => isEmployeeRole((d.data() as AppUser).role)).length;
    const limit = employeeLimit(plan, planPermissions !== null);
    if (!canAddEmployee(current, limit)) {
      throw new AuthError(`Tu plan permite hasta ${limit} usuarios`, 409);
    }

    const record = await adminAuth.createUser({ email, password, displayName });
    createdUid = record.uid;
    const now = new Date().toISOString();
    const userDoc: AppUser = {
      uid: record.uid, email, displayName, role: 'restaurant_employee', restaurantId,
      isActive: true, fullAccess, grantedPermissions: granted, createdAt: now, updatedAt: now,
    };
    await adminDb.collection('users').doc(record.uid).set(userDoc);
    const effectivePermissions = await syncUserPermissions(record.uid);
    return NextResponse.json({ uid: record.uid, effectivePermissions });
  } catch (error) {
    // Rollback: no dejar cuentas de Auth ni documentos a medias
    if (createdUid) {
      await adminAuth.deleteUser(createdUid).catch(() => {});
      await adminDb.collection('users').doc(createdUid).delete().catch(() => {});
    }
    const code = (error as { code?: string }).code ?? '';
    if (code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 });
    }
    if (code === 'auth/invalid-email') {
      return NextResponse.json({ error: 'El correo no es válido' }, { status: 400 });
    }
    return errorResponse(error, 'Error al crear el usuario');
  }
}

// ─── PATCH: editar datos, contraseña, estado o permisos ───────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    const body = (await request.json()) as {
      uid?: string; displayName?: string; email?: string; password?: string; isActive?: boolean;
      fullAccess?: boolean; grantedPermissions?: unknown[];
    };
    const { ref, user: target } = await loadTarget(body.uid);
    if (!canManageUser(caller, target)) throw new AuthError('No puedes administrar este usuario', 403);

    const authUpdates: { email?: string; password?: string; displayName?: string; disabled?: boolean } = {};
    const docUpdates: Partial<AppUser> = {};

    if (body.password !== undefined) {
      requirePerm(caller, 'team.reset_password');
      if (body.password.length < 6) throw new AuthError('La contraseña debe tener al menos 6 caracteres', 400);
      authUpdates.password = body.password;
    }

    const wantsProfile = body.displayName !== undefined || body.email !== undefined || body.isActive !== undefined;
    const wantsPerms = body.fullAccess !== undefined || body.grantedPermissions !== undefined;
    if (wantsProfile || wantsPerms) requirePerm(caller, 'team.update');

    if (body.displayName !== undefined) {
      const name = body.displayName.trim();
      if (!name) throw new AuthError('El nombre es obligatorio', 400);
      authUpdates.displayName = name;
      docUpdates.displayName = name;
    }
    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!email) throw new AuthError('El correo es obligatorio', 400);
      authUpdates.email = email;
      docUpdates.email = email;
    }
    if (body.isActive !== undefined) {
      docUpdates.isActive = !!body.isActive;
      authUpdates.disabled = !body.isActive; // también bloquea el inicio de sesión
    }

    if (wantsPerms) {
      const { planPermissions } = await getRestaurantPlan(target.restaurantId ?? '');
      const fullAccess = body.fullAccess ?? !!target.fullAccess;
      if (fullAccess && !canGrantFullAccess(caller, planPermissions)) {
        throw new AuthError('No puedes dar acceso completo', 403);
      }
      const granted = fullAccess ? [] : normalizePermissions(body.grantedPermissions ?? target.grantedPermissions ?? [])
        .filter((p) => !p.startsWith('features.'));
      if (!fullAccess) {
        if (granted.length === 0) throw new AuthError('Elige al menos un permiso o "Acceso completo"', 400);
        assertGrant(caller, granted, planPermissions);
      }
      docUpdates.fullAccess = fullAccess;
      docUpdates.grantedPermissions = granted;
      // Migra el rol legado al guardar permisos
      if (target.role === 'restaurant_view') docUpdates.role = 'restaurant_employee';
    }

    if (Object.keys(authUpdates).length) await adminAuth.updateUser(target.uid, authUpdates);
    if (Object.keys(docUpdates).length) {
      await ref.update({ ...docUpdates, updatedAt: new Date().toISOString() });
    }
    const effectivePermissions = wantsPerms ? await syncUserPermissions(target.uid) : target.effectivePermissions ?? null;
    return NextResponse.json({ ok: true, effectivePermissions });
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 });
    }
    return errorResponse(error, 'Error al actualizar el usuario');
  }
}

// ─── DELETE: eliminar empleado (Auth + documento) ─────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    requirePerm(caller, 'team.delete');
    const { uid } = (await request.json()) as { uid?: string };
    const { ref, user: target } = await loadTarget(uid);
    if (!canManageUser(caller, target)) throw new AuthError('No puedes eliminar este usuario', 403);
    if (!EMPLOYEE_ROLES.includes(target.role as (typeof EMPLOYEE_ROLES)[number])) {
      throw new AuthError('Solo se pueden eliminar empleados', 403);
    }
    await adminAuth.deleteUser(target.uid).catch((e: { code?: string }) => {
      if (e.code !== 'auth/user-not-found') throw e;
    });
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'Error al eliminar el usuario');
  }
}
