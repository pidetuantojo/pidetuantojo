import type { CashRegister, Denomination } from '../../types/cash.types';

export interface OpenShiftFormProps {
  restaurantId: string;
  registers: readonly CashRegister[];
  denominations: readonly Denomination[];
}
