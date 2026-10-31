import { expect } from 'vitest';
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DEFAULT_DENOMINATIONS } from '@/lib/cash/denominations.helpers';
import type { CashRegister, CashSettings, ShiftRow } from '@/features/cash/types/cash.types';
import type { PaymentMethodConfig } from '@/types';
import { useConfirmStore } from '@/store/confirm.store';

export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Abre el `Select` propio (portal) por su etiqueta y elige la opción por su texto. */
export async function pickOption(label: string | RegExp, option: string | RegExp) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole('button', { name: option }));
}

/** Responde el diálogo de confirmación global (`showConfirm`). */
export async function answerConfirm(value: boolean) {
  await waitFor(() => expect(useConfirmStore.getState().isOpen).toBe(true));
  act(() => useConfirmStore.getState().respond(value));
}

export const PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'pm-efectivo', type: 'efectivo', isActive: true },
  { id: 'pm-nequi', type: 'nequi', isActive: true, account: '3001234567' },
  { id: 'pm-datafono', type: 'datafono', isActive: true },
];

export const RESTAURANT = {
  id: 'r1',
  cashModuleEnabled: true,
  paymentMethods: PAYMENT_METHODS,
};

const stamp = '2026-10-31T13:30:00.000Z';

export const REGISTER: CashRegister = {
  id: 'reg1',
  type: 'REGISTRADORA',
  name: 'Caja 1',
  isActive: true,
  ledgerAccountId: 'acc-cash',
  diffThreshold: 2000,
  createdAt: stamp,
  updatedAt: stamp,
};

export const GENERAL: CashRegister = {
  ...REGISTER,
  id: 'gen1',
  type: 'GENERAL',
  name: 'Caja general',
};

export const SETTINGS: CashSettings = {
  denominations: [...DEFAULT_DENOMINATIONS],
  paymentMethodAccounts: {},
  defaultGeneralRegisterId: 'gen1',
};

export const shiftRow = (overrides: Partial<ShiftRow> = {}): ShiftRow => ({
  id: 's1',
  registerId: 'reg1',
  cashierUid: 'u9',
  status: 'CERRADO_PENDIENTE_APROBACION',
  openedAt: stamp,
  openingAccountingDate: '2026-10-31',
  openingCount: {},
  openingTotal: 0,
  ...overrides,
});

export const account = (id: string, code: string, name: string, cls = 'ACTIVO') => ({
  id,
  code,
  name,
  class: cls as 'ACTIVO',
  nature: 'DEBITO' as const,
  isActive: true,
  allowsMovements: true,
  needsAccountantReview: false,
  createdAt: stamp,
  updatedAt: stamp,
});
