'use client';

import { useAuth } from '@/features/auth';

import { CashPageHeader } from '../CashLayout';
import { CashModuleGate } from '../CashModuleGate';

import { ActivationCard } from './ActivationCard';
import { PettyCategoriesCard } from './PettyCategoriesCard';
import { RegistersCard } from './RegistersCard';
import { SettingsCard } from './SettingsCard';

/** Configuración de caja: activación del módulo, cajas y ajustes. */
export function CashConfigManager() {
  const { can } = useAuth();
  return (
    <div className="space-y-6">
      <CashPageHeader
        title="Configuración de caja"
        description="Activá el módulo y definí cajas y cuentas"
      />
      <CashModuleGate permission="cash.registers.manage" allowInactive>
        {(restaurantId) => (
          <div className="space-y-5">
            <ActivationCard restaurantId={restaurantId} />
            <RegistersCard restaurantId={restaurantId} />
            {can('petty_cash.manage') && <PettyCategoriesCard restaurantId={restaurantId} />}
            <SettingsCard restaurantId={restaurantId} />
          </div>
        )}
      </CashModuleGate>
    </div>
  );
}
