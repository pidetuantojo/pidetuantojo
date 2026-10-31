'use client';

import Link from 'next/link';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';

import { useCashModule } from '../../hooks/useCashModule';
import { CashCard } from '../CashLayout';

import type { CashModuleGateProps } from './CashModuleGate.types';

/**
 * Envuelve cada pantalla de caja: exige permiso y, salvo en configuración, que el módulo esté
 * activo (si no, explica cómo activarlo). Entrega el `restaurantId` ya resuelto.
 */
export function CashModuleGate({ permission, allowInactive, children }: CashModuleGateProps) {
  const { user, can } = useAuth();
  const restaurantId = user?.restaurantId ?? '';
  const { isLoading } = useRestaurant(restaurantId || undefined);
  const { enabled } = useCashModule(restaurantId);

  if (!restaurantId) {
    return <p className="text-sm text-red-600">Tu cuenta no tiene un restaurante asignado.</p>;
  }
  if (!can(permission)) {
    return <p className="text-sm text-red-600">No tenés permiso para ver esta pantalla.</p>;
  }
  if (isLoading && !allowInactive) {
    return <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>;
  }
  if (!enabled && !allowInactive) {
    return (
      <CashCard>
        <div className="space-y-2 py-6 text-center">
          <p className="text-base font-bold text-[var(--t-text-1)]">
            El módulo de caja no está activo
          </p>
          <p className="text-sm text-[var(--t-text-3)]">
            Mientras no esté activo, los cobros siguen funcionando como siempre y no se usan turnos.
          </p>
          {can('cash.registers.manage') && (
            <Link
              href={ROUTES.dashboard.caja.configuracion}
              className="inline-block text-sm font-semibold text-[#FF6A1A] hover:underline"
            >
              Ir a la configuración de caja
            </Link>
          )}
        </div>
      </CashCard>
    );
  }
  return <>{children(restaurantId)}</>;
}
