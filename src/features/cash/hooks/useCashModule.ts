import { useEffect } from 'react';

import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { setCashModuleEnabled } from '../helpers/cash-module-flag';

/**
 * ¿Tiene el restaurante activo el módulo de caja? Lee `cashModuleEnabled` del documento del
 * restaurante (el mismo query que usa el tablero de pedidos; no abre otro listener).
 * Mientras carga devuelve `false`: el comportamiento anterior sigue siendo el seguro.
 */
export function useCashModule(restaurantId: string | undefined): { enabled: boolean } {
  const { data: restaurant } = useRestaurant(restaurantId || undefined);
  const enabled = restaurant?.cashModuleEnabled === true;
  useEffect(() => {
    setCashModuleEnabled(enabled);
  }, [enabled]);
  return { enabled };
}
