'use client';

import type { ReactNode } from 'react';

import type { Permission } from '@/constants/permissions';
import { useAuth } from '@/features/auth';

interface LedgerModuleGateProps {
  permission: Permission;
  children: (restaurantId: string) => ReactNode;
}

/**
 * Envuelve cada pantalla del libro: exige permiso (que ya implica `features.cash` del plan) y un
 * restaurante. No depende de que la caja esté activada: el contador puede preparar cuentas y
 * reglas antes de la activación.
 */
export function LedgerModuleGate({ permission, children }: LedgerModuleGateProps) {
  const { user, can } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  if (!restaurantId) {
    return <p className="text-sm text-red-600">Tu cuenta no tiene un restaurante asignado.</p>;
  }
  if (!can(permission)) {
    return <p className="text-sm text-red-600">No tenés permiso para ver esta pantalla.</p>;
  }
  return <>{children(restaurantId)}</>;
}
