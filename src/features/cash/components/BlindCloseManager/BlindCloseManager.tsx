'use client';

import { CashPageHeader } from '../CashLayout';
import { CashModuleGate } from '../CashModuleGate';

import { BlindCloseView } from './BlindCloseView';

/** Cierre a ciegas del turno: el cajero cuenta sin ver el esperado ni diferencias. */
export function BlindCloseManager() {
  return (
    <div className="space-y-6">
      <CashPageHeader title="Cierre de turno" description="Contá el efectivo y enviá el cierre" />
      <CashModuleGate permission="cash.operate">
        {(restaurantId) => <BlindCloseView restaurantId={restaurantId} />}
      </CashModuleGate>
    </div>
  );
}
