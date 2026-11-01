import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import {
  account,
  GENERAL,
  renderWithClient,
  REGISTER,
  RESTAURANT,
  SETTINGS,
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
    uid: { value: 'u1' },
    authFetch: vi.fn(),
    api: {
      listRegisters: vi.fn(),
      getSettings: vi.fn(),
      listLedgerAccounts: vi.fn(),
      getPettyStatus: vi.fn(),
      listPettyExpenses: vi.fn(),
      listPettyReimbursements: vi.fn(),
      listPettyCategories: vi.fn(),
      createPettyExpense: vi.fn(),
      approvePettyReimbursement: vi.fn(),
      addPettyAttachment: vi.fn(),
    },
  };
});

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('@/lib/auth/authFetch', () => ({ authFetch: mocks.authFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { uid: mocks.uid.value, restaurantId: 'r1' },
    can: (p: string) => mocks.perms.has(p),
  }),
}));
vi.mock('@/features/restaurants/hooks/useRestaurants', () => ({
  useRestaurant: () => ({ data: RESTAURANT, isLoading: false }),
}));
vi.mock('@/features/cash/services/cash.api', () => ({
  CashApiError: mocks.CashApiError,
  cashApi: mocks.api,
}));

import { AttachmentUpload } from '@/features/cash/components/AttachmentUpload';
import { PettyCashManager } from '@/features/cash/components/PettyCashManager';
import { ExpenseFormDialog } from '@/features/cash/components/PettyCashManager/ExpenseFormDialog';
import { PettyStatusCard } from '@/features/cash/components/PettyCashManager/PettyStatusCard';
import type { PettyStatus, ReimbursementRow } from '@/features/cash/types/cash.petty.types';

const PETTY = { ...REGISTER, id: 'menor1', type: 'MENOR' as const, name: 'Caja menor' };

const STATUS: PettyStatus = {
  fundAmount: 200000,
  constituted: true,
  cashOnHand: 150000,
  pendingVouchersTotal: 50000,
  invariantOk: true,
  counts: { PENDIENTE: 1, LEGALIZADO: 0, REEMBOLSADO: 0, ANULADO: 0 },
  maxExpense: 50000,
};

const reimbursement = (requestedBy: string): ReimbursementRow => ({
  id: 'rb1',
  registerId: 'menor1',
  expenseIds: ['e1'],
  total: 30000,
  status: 'PENDIENTE_APROBACION',
  requestedBy,
  requestedAt: '2026-10-31T13:00:00.000Z',
});

beforeEach(() => {
  mocks.perms = new Set(['petty_cash.manage', 'petty_cash.approve']);
  mocks.uid.value = 'u1';
  Object.values(mocks.api).forEach((fn) => fn.mockReset());
  mocks.authFetch.mockReset();
  mocks.api.listRegisters.mockResolvedValue([PETTY, GENERAL]);
  mocks.api.getSettings.mockResolvedValue(SETTINGS);
  mocks.api.listLedgerAccounts.mockResolvedValue([account('acc-bank', '111005', 'Bancolombia')]);
  mocks.api.getPettyStatus.mockResolvedValue(STATUS);
  mocks.api.listPettyExpenses.mockResolvedValue([]);
  mocks.api.listPettyReimbursements.mockResolvedValue([]);
  mocks.api.listPettyCategories.mockResolvedValue([
    {
      id: 'c1',
      name: 'Aseo',
      ledgerAccountId: 'acc',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
  ]);
});

describe('tarjeta de estado del fondo', () => {
  const props = { isLoading: false, isError: false, canAdjustFund: true, onFund: vi.fn() };

  it('muestra fondo, efectivo, vales y el invariante cuadrado', () => {
    renderWithClient(<PettyStatusCard status={STATUS} {...props} />);
    expect(screen.getByTestId('petty-fund')).toHaveTextContent('200.000');
    expect(screen.getByTestId('petty-cash')).toHaveTextContent('150.000');
    expect(screen.getByTestId('petty-pending')).toHaveTextContent('50.000');
    expect(screen.getByText('Fondo cuadrado')).toBeInTheDocument();
  });

  it('avisa cuando el fondo está descuadrado', () => {
    renderWithClient(<PettyStatusCard status={{ ...STATUS, invariantOk: false }} {...props} />);
    expect(screen.getByText('Fondo descuadrado')).toBeInTheDocument();
  });

  it('sin constituir ofrece constituir el fondo', () => {
    renderWithClient(
      <PettyStatusCard status={{ ...STATUS, constituted: false, fundAmount: 0 }} {...props} />
    );
    expect(screen.getByRole('button', { name: 'Constituir fondo' })).toBeInTheDocument();
    expect(screen.getByText(/todavía no está constituido/i)).toBeInTheDocument();
  });

  it('quien no aprueba no ve el botón del fondo', () => {
    renderWithClient(<PettyStatusCard status={STATUS} {...props} canAdjustFund={false} />);
    expect(screen.queryByRole('button', { name: /fondo/i })).not.toBeInTheDocument();
  });
});

describe('modal de gasto', () => {
  const open = () =>
    renderWithClient(
      <ExpenseFormDialog
        restaurantId="r1"
        registerId="menor1"
        maxExpense={50000}
        cashOnHand={150000}
        onClose={vi.fn()}
      />
    );

  it('valida antes de enviar y no llama a la API', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByText('Ingresá un monto mayor a cero')).toBeInTheDocument();
    expect(screen.getByText('Escribí el concepto')).toBeInTheDocument();
    expect(screen.getByText('Escribí el nombre del tercero')).toBeInTheDocument();
    expect(screen.getByText('Elegí la categoría')).toBeInTheDocument();
    expect(mocks.api.createPettyExpense).not.toHaveBeenCalled();
  });

  it('rechaza un monto sobre el máximo por gasto', async () => {
    open();
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '60000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByText(/supera el máximo por gasto/i)).toBeInTheDocument();
    expect(mocks.api.createPettyExpense).not.toHaveBeenCalled();
  });
});

describe('reembolsos en pantalla', () => {
  it('quien solicitó no ve Aprobar; otra persona con permiso sí', async () => {
    mocks.api.listPettyReimbursements.mockResolvedValue([reimbursement('u1')]);
    const first = renderWithClient(<PettyCashManager />);
    expect(await screen.findByText(/Otra persona debe aprobarlo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    first.unmount();

    mocks.uid.value = 'u2';
    renderWithClient(<PettyCashManager />);
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
  });

  it('sin permiso de aprobar no hay botones de decisión', async () => {
    mocks.perms = new Set(['petty_cash.manage']);
    mocks.uid.value = 'u2';
    mocks.api.listPettyReimbursements.mockResolvedValue([reimbursement('u1')]);
    renderWithClient(<PettyCashManager />);
    await screen.findByText('Pendiente de aprobación');
    await waitFor(() => expect(mocks.api.getPettyStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajustar fondo' })).not.toBeInTheDocument();
  });
});

describe('subida de adjuntos', () => {
  it('sube con authFetch (sesión del usuario) y entrega el adjunto', async () => {
    mocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://res.cloudinary.com/demo/raw/upload/v1/vale.pdf' }),
    });
    const onUploaded = vi.fn();
    renderWithClient(<AttachmentUpload value={[]} onUploaded={onUploaded} />);
    const file = new File(['%PDF-1.4'], 'vale.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [file] } });

    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    expect(mocks.authFetch).toHaveBeenCalledWith(
      '/api/cloudinary/upload',
      expect.objectContaining({ method: 'POST' })
    );
    expect(onUploaded).toHaveBeenCalledWith({
      url: 'https://res.cloudinary.com/demo/raw/upload/v1/vale.pdf',
      kind: 'pdf',
      name: 'vale.pdf',
    });
  });

  it('rechaza tipos no permitidos sin llamar al servidor', async () => {
    renderWithClient(<AttachmentUpload value={[]} onUploaded={vi.fn()} />);
    const svg = new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' });
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [svg] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/JPG, PNG, WebP o un PDF/);
    expect(mocks.authFetch).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor (415) y los chips con opción de quitar', async () => {
    mocks.authFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'El contenido del archivo no coincide con su tipo.' }),
    });
    const onRemove = vi.fn();
    renderWithClient(
      <AttachmentUpload
        value={[{ url: 'https://res.cloudinary.com/demo/a.jpg', kind: 'image', name: 'a.jpg' }]}
        onUploaded={vi.fn()}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Quitar a.jpg' }));
    expect(onRemove).toHaveBeenCalledWith(0);
    const png = new File(['x'], 'b.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [png] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/no coincide/);
  });
});
