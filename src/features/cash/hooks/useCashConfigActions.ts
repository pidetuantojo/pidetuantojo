import { useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

import { cashApi } from '../services/cash.api';
import type {
  CashRegister,
  CashSettings,
  CreateRegisterInput,
  LedgerSetupResult,
  UpdateRegisterInput,
  UpdateSettingsInput,
} from '../types/cash.types';

import { useCashMutation } from './useCashMutation';

/** Configuración: cajas, ajustes y siembra del plan de cuentas. */
export function useCashConfigActions(restaurantId: string) {
  const queryClient = useQueryClient();

  const createRegister = useCashMutation<CreateRegisterInput, CashRegister>(restaurantId, {
    signature: (i) => `register:create:${JSON.stringify(i)}`,
    call: (i, key) => cashApi.createRegister(i, key),
    successMessage: 'Caja creada',
  });

  const updateRegister = useCashMutation<
    { registerId: string; input: UpdateRegisterInput },
    CashRegister
  >(restaurantId, {
    signature: (i) => `register:update:${JSON.stringify(i)}`,
    call: (i, key) => cashApi.updateRegister(i.registerId, i.input, key),
    successMessage: 'Caja actualizada',
  });

  const updateSettings = useCashMutation<UpdateSettingsInput, CashSettings>(restaurantId, {
    signature: (i) => `settings:${JSON.stringify(i)}`,
    call: async (i, key) => {
      const settings = await cashApi.updateSettings(i, key);
      queryClient.setQueryData(QUERY_KEYS.cashSettings(restaurantId), settings);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashActivation(restaurantId) });
      return settings;
    },
    successMessage: 'Ajustes guardados',
  });

  const setupLedger = useCashMutation<void, LedgerSetupResult>(restaurantId, {
    signature: () => 'ledger:setup',
    call: async (_input, key) => {
      const result = await cashApi.setupLedger(key);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ledgerAccounts(restaurantId) });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashActivation(restaurantId) });
      return result;
    },
    successMessage: 'Plan de cuentas listo',
  });

  return { createRegister, updateRegister, updateSettings, setupLedger };
}
