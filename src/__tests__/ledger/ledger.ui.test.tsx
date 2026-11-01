import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { account, renderWithClient } from '../cash/ui/cashUiTestUtils';

const mocks = vi.hoisted(() => ({
  perms: new Set<string>(),
  accounts: [] as unknown[],
  api: {
    listRules: vi.fn(),
    getJournal: vi.fn(),
    updateAccount: vi.fn(),
    createAccount: vi.fn(),
    setup: vi.fn(),
    reverseEntry: vi.fn(),
    updateRule: vi.fn(),
    deactivateRule: vi.fn(),
  },
}));

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('@/lib/auth/authFetch', () => ({ authFetch: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/libros' }));
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { uid: 'u1', restaurantId: 'r1' },
    can: (p: string) => mocks.perms.has(p),
  }),
}));
vi.mock('@/features/ledger/services/ledger.api', () => ({ ledgerApi: mocks.api }));
vi.mock('@/features/cash/hooks/useCashQueries', () => ({
  useLedgerAccounts: () => ({ data: mocks.accounts, isLoading: false, isError: false }),
}));

import { AccountingRules } from '@/features/ledger/components/AccountingRules';
import { ChartOfAccounts } from '@/features/ledger/components/ChartOfAccounts';
import { JournalBook } from '@/features/ledger/components/JournalBook';
import { LedgerApiError } from '@/features/ledger/services/ledger.http';

const caja = account('a1', '110505', 'Caja general');
const ventas = { ...account('a2', '4140', 'Hoteles y restaurantes', 'INGRESO'), nature: 'CREDITO' };
const reviewed = { ...ventas, needsAccountantReview: true };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.perms = new Set(['ledger.view']);
  mocks.accounts = [caja, reviewed];
});

describe('Plan de cuentas', () => {
  it('muestra la insignia "A validar por el contador"', () => {
    renderWithClient(<ChartOfAccounts />);
    expect(screen.getByText('A validar por el contador')).toBeInTheDocument();
    expect(screen.getByText('Caja general')).toBeInTheDocument();
    // sin ledger.manage no hay edición
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva cuenta' })).not.toBeInTheDocument();
  });

  it('con ledger.manage muestra el mensaje en español de ACCOUNT_IMMUTABLE', async () => {
    mocks.perms.add('ledger.manage');
    mocks.api.updateAccount.mockRejectedValue(
      new LedgerApiError(409, 'ACCOUNT_IMMUTABLE', 'immutable')
    );
    renderWithClient(<ChartOfAccounts />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText(/ya tiene movimientos/)).toBeInTheDocument();
    expect(mocks.api.updateAccount).toHaveBeenCalledTimes(1);
  });

  it('sin cuentas ofrece "Inicializar plan de cuentas" a quien administra', async () => {
    mocks.accounts = [];
    mocks.perms.add('ledger.manage');
    mocks.api.setup.mockResolvedValue({ created: true, accounts: 10, rules: 20 });
    renderWithClient(<ChartOfAccounts />);
    fireEvent.click(screen.getByRole('button', { name: 'Inicializar plan de cuentas' }));
    await waitFor(() => expect(mocks.api.setup).toHaveBeenCalledTimes(1));
  });

  it('sin permiso de ver no muestra la pantalla', () => {
    mocks.perms = new Set();
    renderWithClient(<ChartOfAccounts />);
    expect(screen.getByText(/No tenés permiso/)).toBeInTheDocument();
  });
});

describe('Reglas contables', () => {
  const rule = (overrides: Record<string, unknown>) => ({
    id: 'r1',
    event: 'SALE',
    methodType: 'efectivo',
    debit: { kind: 'sourceCashBox' },
    credit: { kind: 'fixed', accountId: 'a2' },
    version: 2,
    isActive: true,
    createdAt: '2026-03-10T15:00:00.000Z',
    createdBy: 'u1',
    ...overrides,
  });

  it('describe "Caja del movimiento" y la cuenta fija por nombre', async () => {
    mocks.api.listRules.mockResolvedValue([rule({})]);
    renderWithClient(<AccountingRules />);
    expect(await screen.findByText('Caja del movimiento')).toBeInTheDocument();
    expect(screen.getByText(/4140 · Hoteles y restaurantes/)).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText(/nunca modifica los asientos pasados/)).toBeInTheDocument();
  });

  it('las versiones anteriores solo aparecen con el interruptor de historial', async () => {
    mocks.api.listRules.mockResolvedValue([
      rule({}),
      rule({ id: 'r0', version: 1, isActive: false, supersededAt: '2026-03-11T00:00:00.000Z' }),
    ]);
    renderWithClient(<AccountingRules />);
    await screen.findByText('v2');
    expect(screen.queryByText('v1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Mostrar versiones anteriores/));
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('Reemplazada')).toBeInTheDocument();
  });

  it('editar y desactivar solo con ledger.manage', async () => {
    mocks.api.listRules.mockResolvedValue([rule({})]);
    const { unmount } = renderWithClient(<AccountingRules />);
    await screen.findByText('v2');
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    unmount();
    mocks.perms.add('ledger.manage');
    renderWithClient(<AccountingRules />);
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
  });
});

describe('Libro diario', () => {
  const entry = (overrides: Record<string, unknown> = {}) => ({
    id: 'e1',
    number: 'CC-000001',
    sequence: 1,
    accountingDate: '2026-03-10',
    event: 'SALE',
    description: 'Venta',
    sourceType: 'order',
    sourceId: 'o1',
    totalDebit: 50000,
    totalCredit: 50000,
    lines: [
      { accountId: 'a1', debit: 50000, credit: 0 },
      { accountId: 'a2', debit: 0, credit: 50000 },
    ],
    ...overrides,
  });

  beforeEach(() => {
    mocks.api.getJournal.mockResolvedValue({
      entries: [entry(), entry({ id: 'e2', number: 'CC-000002', reversedByEntryId: 'e3' })],
      nextCursor: null,
    });
  });

  it('los botones de exportar se ocultan sin ledger.export', async () => {
    renderWithClient(<JournalBook />);
    await screen.findByText('CC-000001');
    expect(screen.queryByRole('button', { name: /Exportar Excel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument();
  });

  it('con ledger.export aparecen', async () => {
    mocks.perms.add('ledger.export');
    renderWithClient(<JournalBook />);
    await screen.findByText('CC-000001');
    expect(screen.getByRole('button', { name: /Exportar Excel/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Exportar CSV/ })).toBeEnabled();
  });

  it('reversar solo con ledger.manage, y los reversados llevan insignia', async () => {
    mocks.perms.add('ledger.manage');
    mocks.api.reverseEntry.mockResolvedValue(entry());
    renderWithClient(<JournalBook />);
    await screen.findByText('CC-000002');
    expect(screen.getByText('Reversado')).toBeInTheDocument();
    // solo el asiento vigente ofrece reversar
    const buttons = screen.getAllByRole('button', { name: 'Reversar asiento' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    fireEvent.change(await screen.findByLabelText('Motivo'), {
      target: { value: 'Cobro duplicado' },
    });
    const confirm = screen.getAllByRole('button', { name: 'Reversar asiento' }).pop()!;
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(mocks.api.reverseEntry).toHaveBeenCalledWith(
        'e1',
        'Cobro duplicado',
        expect.any(String)
      )
    );
  });
});
