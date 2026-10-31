import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import {
  account,
  answerConfirm,
  GENERAL,
  pickOption,
  REGISTER,
  RESTAURANT,
  SETTINGS,
  renderWithClient,
  shiftRow,
} from './cashUiTestUtils';

const mocks = vi.hoisted(() => {
  class CashApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
      readonly missing: string[] = []
    ) {
      super(message);
    }
  }
  return {
    CashApiError,
    perms: new Set<string>(),
    restaurant: { value: null as unknown },
    api: {
      listShifts: vi.fn(),
      listShiftMovements: vi.fn(),
      listRegisters: vi.fn(),
      listLedgerAccounts: vi.fn(),
      getClosing: vi.fn(),
      approveClose: vi.fn(),
      decideWithdrawal: vi.fn(),
      getRegisterBalance: vi.fn(),
      deposit: vi.fn(),
      settle: vi.fn(),
      createGeneralMovement: vi.fn(),
      getSettings: vi.fn(),
      getActivation: vi.fn(),
      setActivation: vi.fn(),
      setupLedger: vi.fn(),
      updateSettings: vi.fn(),
      createRegister: vi.fn(),
      updateRegister: vi.fn(),
    },
  };
});

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { uid: 'u1', restaurantId: 'r1' },
    can: (p: string) => mocks.perms.has(p),
  }),
}));
vi.mock('@/features/restaurants/hooks/useRestaurants', () => ({
  useRestaurant: () => ({ data: mocks.restaurant.value, isLoading: false }),
}));
vi.mock('@/features/cash/hooks/useRegisterMovements', () => ({
  useRegisterMovements: () => ({ movements: [], isLoading: false, error: null }),
}));
vi.mock('@/features/cash/services/cash.api', () => ({
  CashApiError: mocks.CashApiError,
  cashApi: mocks.api,
}));

import { ApprovalsManager } from '@/features/cash/components/ApprovalsManager';
import { CashConfigManager } from '@/features/cash/components/CashConfigManager';
import { GeneralBoxManager } from '@/features/cash/components/GeneralBoxManager';

const ACCOUNTS = [
  account('acc-bank', '111005', 'Bancolombia'),
  account('acc-short', '519595', 'Faltantes de caja', 'GASTO'),
  { ...account('acc-group', '11', 'Disponible'), allowsMovements: false },
  { ...account('acc-old', '999', 'Cuenta vieja'), isActive: false },
];

const closingFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  shiftId: 's1',
  registerId: 'reg1',
  cashierUid: 'u9',
  cashCount: {},
  countedCash: 95000,
  expectedByMethod: { efectivo: 100000 },
  declaredByMethod: { efectivo: 95000 },
  differenceByMethod: { efectivo: -5000 },
  cashDifference: -5000,
  diffThreshold: 2000,
  justification: 'Se dio un vuelto de más',
  status: 'PENDIENTE_APROBACION',
  ...overrides,
});

beforeEach(() => {
  Object.values(mocks.api).forEach((fn) => fn.mockReset());
  mocks.perms = new Set(['cash.view', 'cash.approve']);
  mocks.restaurant.value = RESTAURANT;
  mocks.api.listRegisters.mockResolvedValue([REGISTER, GENERAL]);
  mocks.api.listLedgerAccounts.mockResolvedValue(ACCOUNTS);
  mocks.api.getSettings.mockResolvedValue(SETTINGS);
});

describe('Aprobaciones', () => {
  beforeEach(() => {
    mocks.api.listShifts.mockResolvedValue([
      shiftRow({ id: 's1', cashierUid: 'u9' }),
      shiftRow({ id: 's2', cashierUid: 'u1' }),
      shiftRow({ id: 's3', cashierUid: 'u9', status: 'ABIERTO' }),
    ]);
    mocks.api.listShiftMovements.mockResolvedValue({
      movements: [
        {
          id: 'w1',
          type: 'RETIRO_PARCIAL',
          direction: 'OUT',
          amount: 60000,
          methodType: 'efectivo',
          registerId: 'reg1',
          shiftId: 's3',
          cashierUid: 'u9',
          status: 'PENDIENTE_APROBACION',
          receiptNumber: 'CE-9',
          createdAt: '2026-10-31T14:00:00.000Z',
          reason: 'Llevar a caja fuerte',
        },
      ],
    });
  });

  it('lista el retiro pendiente y lo aprueba con confirmación', async () => {
    mocks.api.decideWithdrawal.mockResolvedValue({});
    renderWithClient(<ApprovalsManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await answerConfirm(true);
    await waitFor(() => expect(mocks.api.decideWithdrawal).toHaveBeenCalledTimes(1));
    expect(mocks.api.decideWithdrawal.mock.calls[0].slice(0, 3)).toEqual([
      's3',
      'w1',
      { decision: 'APROBAR' },
    ]);
  });

  it('el cierre ajeno muestra esperado, contado y diferencia, y se aprueba con cuenta del faltante', async () => {
    mocks.api.getClosing.mockResolvedValue(closingFixture());
    mocks.api.approveClose.mockResolvedValue(closingFixture({ status: 'CERRADO' }));
    renderWithClient(<ApprovalsManager />);

    fireEvent.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0]);
    expect(await screen.findByText(/Faltante/)).toBeInTheDocument();
    expect(screen.getByText('Se dio un vuelto de más')).toBeInTheDocument();
    expect(screen.getAllByText(/100\.000/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Nota de aprobación'), {
      target: { value: 'Revisado con el cajero' },
    });
    // Solo cuentas activas y que reciben asientos
    await screen.findByLabelText('Cuenta del faltante (opcional)');
    fireEvent.click(screen.getByLabelText('Cuenta del faltante (opcional)'));
    await screen.findByRole('button', { name: /Faltantes de caja/ });
    expect(screen.queryByRole('button', { name: /Cuenta vieja/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disponible/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Faltantes de caja/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar cierre' }));

    await waitFor(() => expect(mocks.api.approveClose).toHaveBeenCalledTimes(1));
    const [shiftId, input, key] = mocks.api.approveClose.mock.calls[0] as [string, unknown, string];
    expect(shiftId).toBe('s1');
    expect(input).toEqual({ note: 'Revisado con el cajero', shortageAccountId: 'acc-short' });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('oculta Aprobar en el cierre propio y lo explica', async () => {
    mocks.api.getClosing.mockResolvedValue(closingFixture({ shiftId: 's2', cashierUid: 'u1' }));
    renderWithClient(<ApprovalsManager />);

    fireEvent.click((await screen.findAllByRole('button', { name: 'Revisar' }))[1]);
    expect(await screen.findByText('No podés aprobar tu propio cierre')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar cierre' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nota de aprobación')).not.toBeInTheDocument();
  });

  it('no deja entrar sin cash.approve', async () => {
    mocks.perms = new Set(['cash.view']);
    renderWithClient(<ApprovalsManager />);
    expect(await screen.findByText(/No tenés permiso/)).toBeInTheDocument();
    expect(mocks.api.listShifts).not.toHaveBeenCalled();
  });
});

describe('Caja general', () => {
  beforeEach(() => {
    mocks.api.getRegisterBalance.mockResolvedValue({
      registerId: 'gen1',
      balanceByMethod: { efectivo: 250000 },
      cash: 250000,
    });
  });

  it('muestra el saldo en efectivo', async () => {
    renderWithClient(<GeneralBoxManager />);
    expect(await screen.findByText(/250\.000/)).toBeInTheDocument();
  });

  it('la consignación valida los campos antes de llamar a la API', async () => {
    renderWithClient(<GeneralBoxManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Consignar al banco' }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Consignar' }));
    expect(await within(dialog).findByText('Elegí la cuenta bancaria')).toBeInTheDocument();
    expect(within(dialog).getByText('Ingresá un monto mayor a cero')).toBeInTheDocument();
    expect(within(dialog).getByText('Escribí la referencia')).toBeInTheDocument();
    expect(mocks.api.deposit).not.toHaveBeenCalled();

    mocks.api.deposit.mockResolvedValue({});
    await pickOption('Cuenta bancaria', /Bancolombia/);
    fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '100000' } });
    fireEvent.change(within(dialog).getByLabelText('Referencia de la consignación'), {
      target: { value: 'CONS-77' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Consignar' }));

    await waitFor(() => expect(mocks.api.deposit).toHaveBeenCalledTimes(1));
    const [body, key] = mocks.api.deposit.mock.calls[0] as [unknown, string];
    expect(body).toEqual({
      registerId: 'gen1',
      bankAccountId: 'acc-bank',
      amount: 100000,
      externalRef: 'CONS-77',
    });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('la cuenta contrapartida solo se ofrece con ledger.manage', async () => {
    const { unmount } = renderWithClient(<GeneralBoxManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ingreso' }));
    await screen.findByRole('dialog');
    expect(screen.queryByText('Cuenta contrapartida (opcional)')).not.toBeInTheDocument();
    unmount();

    mocks.perms.add('ledger.manage');
    renderWithClient(<GeneralBoxManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ingreso' }));
    expect(await screen.findByText('Cuenta contrapartida (opcional)')).toBeInTheDocument();
    expect(screen.getByText(/saldo inicial/)).toBeInTheDocument();
  });

  it('la liquidación de datáfono envía medio, cuenta, referencia y fecha', async () => {
    mocks.api.settle.mockResolvedValue({});
    renderWithClient(<GeneralBoxManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Liquidación datáfono' }));
    const dialog = await screen.findByRole('dialog');

    await pickOption('Cuenta bancaria', /Bancolombia/);
    fireEvent.change(within(dialog).getByLabelText('Monto liquidado'), {
      target: { value: '80000' },
    });
    fireEvent.change(within(dialog).getByLabelText('Referencia del lote'), {
      target: { value: 'LOTE-5' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Fecha contable/), {
      target: { value: '2026-10-30' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar liquidación' }));

    await waitFor(() => expect(mocks.api.settle).toHaveBeenCalledTimes(1));
    expect(mocks.api.settle.mock.calls[0][0]).toEqual({
      paymentMethodId: 'pm-datafono',
      bankAccountId: 'acc-bank',
      amount: 80000,
      externalRef: 'LOTE-5',
      accountingDate: '2026-10-30',
    });
  });
});

describe('Configuración de caja', () => {
  beforeEach(() => {
    mocks.perms = new Set(['cash.view', 'cash.registers.manage', 'ledger.manage']);
    mocks.restaurant.value = { ...RESTAURANT, cashModuleEnabled: false };
  });

  it('muestra los requisitos faltantes con su pista y deshabilita Activar', async () => {
    mocks.api.getActivation.mockResolvedValue({
      enabled: false,
      missing: [
        'Configurar el plan de cuentas (libro contable)',
        'Crear al menos una caja general',
      ],
    });
    renderWithClient(<CashConfigManager />);

    expect(
      await screen.findByText('Configurar el plan de cuentas (libro contable)')
    ).toBeInTheDocument();
    expect(screen.getByText('Crear al menos una caja general')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activar módulo' })).toBeDisabled();
  });

  it('Inicializar plan de cuentas llama a la API de siembra', async () => {
    mocks.api.getActivation.mockResolvedValue({
      enabled: false,
      missing: ['Configurar el plan de cuentas (libro contable)'],
    });
    mocks.api.setupLedger.mockResolvedValue({ created: true, accounts: 40, rules: 11 });
    renderWithClient(<CashConfigManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Inicializar plan de cuentas' }));
    await waitFor(() => expect(mocks.api.setupLedger).toHaveBeenCalledTimes(1));
    expect(mocks.api.setupLedger.mock.calls[0][0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('un 409 al activar muestra los requisitos que devolvió el servidor', async () => {
    mocks.api.getActivation.mockResolvedValue({ enabled: false, missing: [] });
    mocks.api.setActivation.mockRejectedValue(
      new mocks.CashApiError(409, 'ACTIVATION_PREREQUISITES', 'Faltan requisitos', [
        'Elegir la caja general por defecto en los ajustes de caja',
      ])
    );
    renderWithClient(<CashConfigManager />);

    const activate = await screen.findByRole('button', { name: 'Activar módulo' });
    await waitFor(() => expect(activate).toBeEnabled());
    fireEvent.click(activate);
    await answerConfirm(true);

    expect(
      await screen.findByText('Elegir la caja general por defecto en los ajustes de caja')
    ).toBeInTheDocument();
  });

  it('desactivar una caja con turno abierto (409) muestra el aviso', async () => {
    mocks.api.getActivation.mockResolvedValue({ enabled: true, missing: [] });
    mocks.api.updateRegister.mockRejectedValue(
      new mocks.CashApiError(409, 'REGISTER_HAS_OPEN_SHIFT', 'La caja tiene un turno abierto')
    );
    renderWithClient(<CashConfigManager />);

    const row = (await screen.findByText('Caja 1')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Desactivar' }));
    expect(
      await screen.findByText('La caja tiene un turno abierto', { selector: 'p' })
    ).toBeInTheDocument();
  });

  it('lista las denominaciones en solo lectura y guarda el mapeo por medio de pago', async () => {
    mocks.api.getActivation.mockResolvedValue({ enabled: false, missing: [] });
    mocks.api.updateSettings.mockResolvedValue(SETTINGS);
    renderWithClient(<CashConfigManager />);

    expect(await screen.findByText('Denominaciones (solo lectura)')).toBeInTheDocument();
    const nequi = await screen.findByLabelText(/Nequi/);
    fireEvent.click(nequi);
    fireEvent.click(await screen.findByRole('button', { name: /Bancolombia/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajustes' }));

    await waitFor(() => expect(mocks.api.updateSettings).toHaveBeenCalledTimes(1));
    expect(mocks.api.updateSettings.mock.calls[0][0]).toMatchObject({
      paymentMethodAccounts: { 'pm-nequi': 'acc-bank' },
      defaultGeneralRegisterId: 'gen1',
    });
  });
});
