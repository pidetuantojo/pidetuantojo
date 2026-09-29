import type { Permission, UserPermission } from '@/constants/permissions';
import { authFetch } from '@/lib/auth/authFetch';
import type { UserRole } from '@/types';

export interface TeamMember {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  isActive: boolean;
  fullAccess: boolean;
  grantedPermissions: Permission[];
  effectivePermissions: Permission[] | null;
  canManage: boolean;
  createdAt: string;
}

export interface TeamData {
  employees: TeamMember[];
  // Lo que quien consulta puede otorgar (permisos propios ∩ plan)
  grantable: UserPermission[];
  canGrantFullAccess: boolean;
  limit: number | null;
  planName: string | null;
  can: { create: boolean; update: boolean; resetPassword: boolean; delete: boolean };
}

export interface CreateMemberData {
  restaurantId: string;
  displayName: string;
  email: string;
  password: string;
  fullAccess: boolean;
  grantedPermissions: Permission[];
}

export type UpdateMemberData = { uid: string } & Partial<{
  displayName: string; email: string; password: string; isActive: boolean;
  fullAccess: boolean; grantedPermissions: Permission[];
}>;

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await authFetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Error inesperado');
  return data;
}

/** Equipo del restaurante: todo pasa por /api/team (el servidor valida permisos y plan). */
export const teamService = {
  get: (restaurantId: string) => call<TeamData>('GET', `/api/team?restaurantId=${encodeURIComponent(restaurantId)}`),
  create: (data: CreateMemberData) => call<{ uid: string }>('POST', '/api/team', data),
  update: (data: UpdateMemberData) => call<{ ok: true }>('PATCH', '/api/team', data),
  remove: (uid: string) => call<{ ok: true }>('DELETE', '/api/team', { uid }),
};
