import { cashApi } from '../services/cash.api';
import type {
  DepositInput,
  GeneralMovementInput,
  MovementRow,
  SettlementInput,
} from '../types/cash.types';

import { useCashMutation } from './useCashMutation';

/** Caja general: ingresos/egresos, consignaciones al banco y liquidaciones de datáfono. */
export function useGeneralBoxActions(restaurantId: string) {
  const movement = useCashMutation<
    { registerId: string; input: GeneralMovementInput },
    MovementRow
  >(restaurantId, {
    signature: (i) => `general:${JSON.stringify(i)}`,
    call: (i, key) => cashApi.createGeneralMovement(i.registerId, i.input, key),
    successMessage: 'Movimiento registrado',
  });

  const deposit = useCashMutation<DepositInput, MovementRow>(restaurantId, {
    signature: (i) => `deposit:${JSON.stringify(i)}`,
    call: (i, key) => cashApi.deposit(i, key),
    successMessage: 'Consignación registrada',
  });

  const settle = useCashMutation<SettlementInput, MovementRow>(restaurantId, {
    signature: (i) => `settle:${JSON.stringify(i)}`,
    call: (i, key) => cashApi.settle(i, key),
    successMessage: 'Liquidación registrada',
  });

  return { movement, deposit, settle };
}
