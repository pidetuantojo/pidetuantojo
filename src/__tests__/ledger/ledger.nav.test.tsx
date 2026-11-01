import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  canAccessPath,
  firstAllowedRoute,
  requiredPermissionForPath,
} from '@/lib/permissions/permissions';

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  pathname: { value: '/dashboard/libros' },
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

function renderSidebar(permissions: string[], pathname = '/dashboard/libros') {
  mocks.permissions = permissions;
  mocks.pathname.value = pathname;
  return render(<Sidebar />);
}

beforeEach(() => {
  mocks.permissions = [];
});

describe('Sidebar: libros contables', () => {
  it('Finanzas muestra libros, plan de cuentas y reglas con ledger.view + plan', () => {
    renderSidebar([...BASE, 'features.cash', 'ledger.view']);
    expect(screen.getByRole('link', { name: 'Libros contables' })).toHaveAttribute(
      'href',
      '/dashboard/libros'
    );
    expect(screen.getByRole('link', { name: 'Plan de cuentas' })).toHaveAttribute(
      'href',
      '/dashboard/libros/plan-de-cuentas'
    );
    expect(screen.getByRole('link', { name: 'Reglas contables' })).toHaveAttribute(
      'href',
      '/dashboard/libros/reglas'
    );
  });

  it('no aparecen sin ledger.view o sin la funcionalidad del plan', () => {
    renderSidebar([...BASE, 'features.cash', 'accounting.view']);
    expect(screen.queryByRole('link', { name: 'Libros contables' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reglas contables' })).not.toBeInTheDocument();
  });

  it('sin features.cash los hijos con `requires` se ocultan aunque quede el permiso suelto', () => {
    renderSidebar([...BASE, 'ledger.view', 'accounting.view']);
    expect(screen.queryByRole('link', { name: 'Libros contables' })).not.toBeInTheDocument();
    // la contabilidad de ventas no se toca
    expect(screen.getByRole('link', { name: 'Contabilidad' })).toBeInTheDocument();
  });

  it('Caja muestra Reportes solo con cash.approve', () => {
    renderSidebar([...BASE, 'features.cash', 'cash.view', 'cash.operate'], '/dashboard/caja');
    expect(screen.queryByRole('link', { name: 'Reportes' })).not.toBeInTheDocument();
    renderSidebar(
      [...BASE, 'features.cash', 'cash.view', 'cash.operate', 'cash.approve'],
      '/dashboard/caja'
    );
    expect(screen.getByRole('link', { name: 'Reportes' })).toHaveAttribute(
      'href',
      '/dashboard/caja/reportes'
    );
  });
});

describe('permisos de rutas nuevas', () => {
  it.each([
    '/dashboard/libros',
    '/dashboard/libros/mayor',
    '/dashboard/libros/balance',
    '/dashboard/libros/plan-de-cuentas',
    '/dashboard/libros/reglas',
  ])('%s exige ledger.view', (path) => {
    expect(requiredPermissionForPath(path)).toBe('ledger.view');
    expect(canAccessPath(['ledger.view'], path)).toBe(true);
    expect(canAccessPath(['cash.view'], path)).toBe(false);
  });

  it('/dashboard/caja/reportes exige cash.approve, no cash.operate', () => {
    expect(requiredPermissionForPath('/dashboard/caja/reportes')).toBe('cash.approve');
    expect(canAccessPath(['cash.operate'], '/dashboard/caja/reportes')).toBe(false);
  });

  it('firstAllowedRoute no manda al contador a una ruta sin acceso (sin bucles)', () => {
    expect(firstAllowedRoute(['features.cash', 'ledger.view'])).toBe('/dashboard/libros');
    expect(firstAllowedRoute(['features.cash', 'cash.view'])).toBeNull();
  });
});
