import { CashApiError } from './cash.http';
import { cashOrdersApi } from './cash.orders.api';
import { cashPettyApi } from './cash.petty.api';
import { cashRegistersApi } from './cash.registers.api';
import { cashShiftsApi } from './cash.shifts.api';

export { CashApiError };

/** Punto único de acceso a la API de caja (cobros, turnos, cajas y plan de cuentas). */
export const cashApi = {
  ...cashOrdersApi,
  ...cashShiftsApi,
  ...cashRegistersApi,
  ...cashPettyApi,
};
