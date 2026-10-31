import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  pathname: { value: '/dashboard' },
}));

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname.value }));
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { uid: 'u1', restaurantId: 'r1', role: 'restaurant_admin', email: 'a@b.co' },
    signOut: vi.fn(),
    permissions: mocks.permissions,
  }),
}));
vi.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'light', toggle: vi.fn() }),
}));
vi.mock('@/features/restaurants/hooks/useRestaurants', () => ({
  useRestaurant: () => ({ data: { name: 'Local' } }),
}));

import { Sidebar } from '@/components/layout/Sidebar';

const BASE = ['dashboard.view'];

function renderSidebar(permissions: string[], pathname = '/dashboard/caja') {
  mocks.permissions = permissions;
  mocks.pathname.value = pathname;
  return render(<Sidebar />);
}

beforeEach(() => {
  mocks.permissions = [];
});

describe('Sidebar: grupo Caja', () => {
  it('aparece con permiso y con la funcionalidad del plan', () => {
    renderSidebar([...BASE, 'features.cash', 'cash.view', 'cash.operate']);
    expect(screen.getByRole('button', { name: /^Caja$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Turno' })).toHaveAttribute('href', '/dashboard/caja');
    // Sin cash.approve ni cash.registers.manage solo ve el turno
    expect(screen.queryByRole('link', { name: 'Aprobaciones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Caja general' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Configuración' })).not.toBeInTheDocument();
  });

  it('cada subpantalla exige su permiso', () => {
    renderSidebar([
      ...BASE,
      'features.cash',
      'cash.view',
      'cash.operate',
      'cash.approve',
      'cash.registers.manage',
    ]);
    expect(screen.getByRole('link', { name: 'Aprobaciones' })).toHaveAttribute(
      'href',
      '/dashboard/caja/aprobaciones'
    );
    expect(screen.getByRole('link', { name: 'Caja general' })).toHaveAttribute(
      'href',
      '/dashboard/caja/general'
    );
    expect(screen.getByRole('link', { name: 'Configuración' })).toHaveAttribute(
      'href',
      '/dashboard/caja/configuracion'
    );
  });

  it('no aparece si el plan no incluye caja, aunque queden permisos sueltos', () => {
    renderSidebar([...BASE, 'cash.view', 'cash.operate', 'cash.approve']);
    expect(screen.queryByRole('button', { name: /^Caja$/ })).not.toBeInTheDocument();
  });

  it('no aparece sin permisos de caja', () => {
    renderSidebar([...BASE, 'features.cash'], '/dashboard');
    expect(screen.queryByRole('button', { name: /^Caja$/ })).not.toBeInTheDocument();
  });

  it('el grupo se puede abrir desde otra ruta', () => {
    renderSidebar([...BASE, 'features.cash', 'cash.view', 'cash.operate'], '/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /^Caja$/ }));
    expect(screen.getByRole('link', { name: 'Turno' })).toBeInTheDocument();
  });
});
