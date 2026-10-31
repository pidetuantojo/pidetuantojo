import type {
  CashRegister,
  CreateRegisterInput,
  DepositInput,
  GeneralMovementInput,
  LedgerAccount,
  LedgerSetupResult,
  MovementRow,
  RegisterBalance,
  SettlementInput,
  UpdateRegisterInput,
} from '../types/cash.types';

import { request } from './cash.http';

const enc = encodeURIComponent;

/** Cajas, caja general (saldo, ingresos, consignaciones, liquidaciones) y plan de cuentas. */
export const cashRegistersApi = {
  listRegisters: async () =>
    (await request<{ registers: CashRegister[] }>('/api/cash/registers')).registers,

  createRegister: (input: CreateRegisterInput, idempotencyKey: string) =>
    request<CashRegister>('/api/cash/registers', { method: 'POST', body: input, idempotencyKey }),

  updateRegister: (registerId: string, input: UpdateRegisterInput, idempotencyKey: string) =>
    request<CashRegister>(`/api/cash/registers/${enc(registerId)}`, {
      method: 'PATCH',
      body: input,
      idempotencyKey,
    }),

  getRegisterBalance: (registerId: string) =>
    request<RegisterBalance>(`/api/cash/registers/${enc(registerId)}/balance`),

  createGeneralMovement: (
    registerId: string,
    input: GeneralMovementInput,
    idempotencyKey: string
  ) =>
    request<MovementRow>(`/api/cash/registers/${enc(registerId)}/movements`, {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  deposit: (input: DepositInput, idempotencyKey: string) =>
    request<MovementRow>('/api/cash/deposits', { method: 'POST', body: input, idempotencyKey }),

  settle: (input: SettlementInput, idempotencyKey: string) =>
    request<MovementRow>('/api/cash/settlements', {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  listLedgerAccounts: async () =>
    (await request<{ accounts: LedgerAccount[] }>('/api/ledger/accounts')).accounts,

  setupLedger: (idempotencyKey: string) =>
    request<LedgerSetupResult>('/api/ledger/setup', {
      method: 'POST',
      body: {},
      idempotencyKey,
    }),
};
