'use client';

import type { Permission } from '@/constants/permissions';
import { useAuth } from '@/features/auth';

interface CanProps {
  // Requiere este permiso…
  permission?: Permission;
  // …o cualquiera de estos
  any?: readonly Permission[];
  // Qué mostrar sin permiso (por defecto, nada)
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Muestra `children` solo si el usuario tiene el permiso.
 * Ojo: es solo UI. La seguridad real está en firestore.rules y en las rutas API.
 */
export function Can({ permission, any, fallback = null, children }: CanProps) {
  const { can, canAny } = useAuth();
  const allowed = (permission ? can(permission) : true) && (any ? canAny(any) : true);
  return <>{allowed ? children : fallback}</>;
}
