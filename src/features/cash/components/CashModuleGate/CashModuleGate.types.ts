import type { ReactNode } from 'react';

import type { Permission } from '@/constants/permissions';

export interface CashModuleGateProps {
  /** Permiso que exige la pantalla; sin él se muestra "sin acceso". */
  permission: Permission;
  /** Si la pantalla funciona aunque el módulo esté apagado (configuración). */
  allowInactive?: boolean;
  children: (restaurantId: string) => ReactNode;
}
