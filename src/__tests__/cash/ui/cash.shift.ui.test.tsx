import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import {
  answerConfirm,
  GENERAL,
  REGISTER,
  RESTAURANT,
  SETTINGS,
  renderWithClient,
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
    pendingClose: { value: false },
    router: { push: vi.fn(), replace: vi.fn() },
    api: {
      getCurrentShift: vi.fn(),
      listRegisters: vi.fn(),
      getSettings: vi.fn(),
      openShift: vi.fn(),
      listShiftMovements: vi.fn(),
      startClose: vi.fn(),
      submitCount: vi.fn(),
      createShiftMovement: vi.fn(),
      reverseMovement: vi.fn(),
    },
  };
});

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { uid: 'u1', restaurantId: 'r1' },
    can: (p: string) => mocks.perms.has(p),
  }),
}));
vi.mock('@/features/restaurants/hooks/useRestaurants', () => ({
  useRestaurant: () => ({ data: mocks.restaurant.value, isLoading: false }),
}));
vi.mock('@/features/cash/hooks/useOwnPendingClose', () => ({
  useOwnPendingClose: () => ({ data: mocks.pendingClose.value }),
}));
vi.mock('@/features/cash/services/cash.api', () => ({
  CashApiError: mocks.CashApiError,
  cashApi: mocks.api,
}));

import { BlindCloseManager } from '@/features/cash/components/BlindCloseManager';
import { CurrentShiftManager } from '@/features/cash/components/CurrentShiftManager';
import { useToastStore } from '@/store/toast.store';

const OPEN_SHIFT = {
  id: 's1',
  registerId: 'reg1',
  status: 'ABIERTO',
  openedAt: '2026-10-31T13:30:00.000Z',
  openingAccountingDate: '2026-10-31',
};

const movement = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  type: 'INGRESO_VARIO',
  direction: 'IN',
  amount: 12000,
  methodType: 'efectivo',
  registerId: 'reg1',
  shiftId: 's1',
  cashierUid: 'u1',
  status: 'APLICADO',
  receiptNumber: 'RC-0001',
  accountingDate: '2026-10-31',
  journalEntryId: null,
  createdAt: '2026-10-31T14:00:00.000Z',
  reason: 'Propina compartida',
  ...overrides,
});

beforeEach(() => {
  Object.values(mocks.api).forEach((fn) => fn.mockReset());
  mocks.router.push.mockReset();
  mocks.router.replace.mockReset();
  mocks.perms = new Set(['cash.operate', 'cash.view']);
  mocks.restaurant.value = RESTAURANT;
  mocks.pendingClose.value = false;
  mocks.api.listRegisters.mockResolvedValue([REGISTER, GENERAL]);
  mocks.api.getSettings.mockResolvedValue(SETTINGS);
  useToastStore.setState({ toasts: [] });
});

describe('Turno actual: abrir turno', () => {
  it('envía el conteo por denominación y una llave de idempotencia', async () => {
    mocks.api.getCurrentShift.mockResolvedValue(null);
    mocks.api.openShift.mockResolvedValue({ id: 's1' });
    renderWithClient(<CurrentShiftManager />);

    const input = await screen.findByLabelText(/Cantidad de Billete de .*50\.000/);
    fireEvent.change(input, { target: { value: '3' } });
    expect(screen.getByTestId('opening-total')).toHaveTextContent('150.000');

    fireEvent.click(screen.getByRole('button', { name: 'Abrir turno' }));

    await waitFor(() => expect(mocks.api.openShift).toHaveBeenCalledTimes(1));
    const [body, key] = mocks.api.openShift.mock.calls[0] as [unknown, string];
    expect(body).toEqual({ registerId: 'reg1', openingCount: { BILLETE_50000: 3 } });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('muestra el aviso de cierre pendiente de aprobación cuando no hay turno', async () => {
    mocks.api.getCurrentShift.mockResolvedValue(null);
    mocks.pendingClose.value = true;
    renderWithClient(<CurrentShiftManager />);
    expect(await screen.findByText('Tu cierre está pendiente de aprobación')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir turno' })).not.toBeInTheDocument();
  });

  it('con el módulo apagado explica cómo activarlo y enlaza a la configuración', async () => {
    mocks.restaurant.value = { ...RESTAURANT, cashModuleEnabled: false };
    mocks.perms.add('cash.registers.manage');
    renderWithClient(<CurrentShiftManager />);
    expect(await screen.findByText('El módulo de caja no está activo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /configuración de caja/i })).toHaveAttribute(
      'href',
      '/dashboard/caja/configuracion'
    );
    expect(mocks.api.getCurrentShift).not.toHaveBeenCalled();
  });
});

describe('Turno actual: panel del turno abierto', () => {
  it('lista los movimientos pero nunca totales ni esperado, aunque la API los mande', async () => {
    mocks.api.getCurrentShift.mockResolvedValue(OPEN_SHIFT);
    mocks.api.listShiftMovements.mockResolvedValue({
      movements: [
        movement(),
        movement({
          id: 'm2',
          type: 'RETIRO_PARCIAL',
          direction: 'OUT',
          amount: 40000,
          status: 'PENDIENTE_APROBACION',
          receiptNumber: 'CE-0002',
        }),
      ],
      // Un servidor con error podría mandar esto: la pantalla no debe pintarlo
      totalsByMethod: { efectivo: 987654 },
      expectedByMethod: { efectivo: 987654 },
    });
    renderWithClient(<CurrentShiftManager />);

    expect(await screen.findByText('RC-0001')).toBeInTheDocument();
    expect(screen.getByText('CE-0002')).toBeInTheDocument();
    expect(screen.getAllByText('Pendiente de aprobación').length).toBeGreaterThan(0);

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/987\.654/);
    expect(text).not.toMatch(/esperado|saldo|total/i);
    expect(screen.queryByRole('button', { name: 'Reversar' })).not.toBeInTheDocument();
  });

  it('el botón Reversar solo aparece con cash.reverse', async () => {
    mocks.perms.add('cash.reverse');
    mocks.api.getCurrentShift.mockResolvedValue(OPEN_SHIFT);
    mocks.api.listShiftMovements.mockResolvedValue({ movements: [movement()] });
    renderWithClient(<CurrentShiftManager />);
    expect(await screen.findByRole('button', { name: 'Reversar' })).toBeInTheDocument();
  });

  it('el retiro parcial avisa que queda pendiente de aprobación y se envía como RETIRO_PARCIAL', async () => {
    mocks.api.getCurrentShift.mockResolvedValue(OPEN_SHIFT);
    mocks.api.listShiftMovements.mockResolvedValue({ movements: [] });
    mocks.api.createShiftMovement.mockResolvedValue(movement());
    renderWithClient(<CurrentShiftManager />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retiro parcial' }));
    expect(await screen.findByText('Pendiente de aprobación')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '40000' } });
    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'Llevar a la caja fuerte' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(mocks.api.createShiftMovement).toHaveBeenCalledTimes(1));
    const [shiftId, input] = mocks.api.createShiftMovement.mock.calls[0] as [string, unknown];
    expect(shiftId).toBe('s1');
    expect(input).toMatchObject({ type: 'RETIRO_PARCIAL', amount: 40000, methodType: 'efectivo' });
  });

  it('un turno en cierre lleva a la pantalla de conteo', async () => {
    mocks.api.getCurrentShift.mockResolvedValue({ ...OPEN_SHIFT, status: 'EN_CIERRE' });
    renderWithClient(<CurrentShiftManager />);
    await waitFor(() =>
      expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/caja/cierre')
    );
  });
});

describe('Cierre ciego', () => {
  const closing = { ...OPEN_SHIFT, status: 'EN_CIERRE' };

  async function fillAndSubmit() {
    const input = await screen.findByLabelText(/Cantidad de Billete de .*20\.000/);
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar conteo' }));
    await answerConfirm(true);
  }

  it('nunca muestra esperado ni diferencias, aunque la API los devuelva por error', async () => {
    mocks.api.getCurrentShift.mockResolvedValue(closing);
    mocks.api.submitCount.mockResolvedValue({
      shiftId: 's1',
      status: 'CERRADO_PENDIENTE_APROBACION',
      expectedByMethod: { efectivo: 777777 },
      cashDifference: -12345,
    });
    renderWithClient(<BlindCloseManager />);

    // Antes de enviar tampoco hay cifras del sistema
    await screen.findByLabelText(/Cantidad de Billete de .*20\.000/);
    expect(document.body.textContent).not.toMatch(/esperado|diferencia|sobrante|faltante/i);

    await fillAndSubmit();

    expect(await screen.findByText('Enviado a aprobación')).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/777\.777|12\.345|esperado|diferencia|sobrante|faltante/i);

    const [shiftId, body, key] = mocks.api.submitCount.mock.calls[0] as [string, unknown, string];
    expect(shiftId).toBe('s1');
    expect(body).toEqual({ cashCount: { BILLETE_20000: 2 } });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('un cierre dentro del umbral muestra solo "Turno cerrado"', async () => {
    mocks.api.getCurrentShift.mockResolvedValue(closing);
    mocks.api.submitCount.mockResolvedValue({ shiftId: 's1', status: 'CERRADO' });
    renderWithClient(<BlindCloseManager />);
    await fillAndSubmit();
    expect(await screen.findByText('Turno cerrado')).toBeInTheDocument();
  });

  it('si se exige justificación muestra un mensaje neutro, sin cifras, y enfoca el campo', async () => {
    mocks.api.getCurrentShift.mockResolvedValue(closing);
    mocks.api.submitCount.mockRejectedValue(
      new mocks.CashApiError(
        400,
        'JUSTIFICATION_REQUIRED',
        'Falta justificar $ 12.345 de diferencia'
      )
    );
    renderWithClient(<BlindCloseManager />);
    await fillAndSubmit();

    expect(
      await screen.findByText('Se requiere una justificación para enviar este cierre')
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/12\.345/);
    expect(document.activeElement).toBe(screen.getByLabelText(/Observaciones/));
    expect(useToastStore.getState().toasts).toHaveLength(0);

    // Reintento con la justificación escrita
    mocks.api.submitCount.mockResolvedValue({
      shiftId: 's1',
      status: 'CERRADO_PENDIENTE_APROBACION',
    });
    fireEvent.change(screen.getByLabelText(/Observaciones/), {
      target: { value: 'Cambio de más' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar conteo' }));
    await answerConfirm(true);
    await waitFor(() => expect(mocks.api.submitCount).toHaveBeenCalledTimes(2));
    expect((mocks.api.submitCount.mock.calls[1] as unknown[])[1]).toMatchObject({
      justification: 'Cambio de más',
    });
  });

  it('el campo Observaciones siempre está visible y es opcional', async () => {
    mocks.api.getCurrentShift.mockResolvedValue(closing);
    renderWithClient(<BlindCloseManager />);
    expect(await screen.findByLabelText('Observaciones (opcional)')).toBeInTheDocument();
  });

  it('con el turno aún abierto pide iniciar el cierre primero', async () => {
    mocks.api.getCurrentShift.mockResolvedValue(OPEN_SHIFT);
    renderWithClient(<BlindCloseManager />);
    expect(await screen.findByText('Primero iniciá el cierre')).toBeInTheDocument();
  });
});
