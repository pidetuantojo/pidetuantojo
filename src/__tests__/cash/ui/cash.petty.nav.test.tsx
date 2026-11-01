import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { canAccessPath, requiredPermissionForPath } from '@/lib/permissions/permissions';

const mocks = vi.hoisted(() => ({ permissions: [] as string[] }));

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/caja/menor' }));
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

beforeEach(() => {
  mocks.permissions = [];
});

describe('ruta /dashboard/caja/menor', () => {
  it('exige petty_cash.manage (approve ya lo implica por el catálogo)', () => {
    expect(requiredPermissionForPath('/dashboard/caja/menor')).toBe('petty_cash.manage');
    expect(canAccessPath(['petty_cash.manage'], '/dashboard/caja/menor')).toBe(true);
    expect(canAccessPath(['cash.view', 'cash.operate'], '/dashboard/caja/menor')).toBe(false);
  });
});

describe('Sidebar: Caja menor', () => {
  it('aparece con el permiso y la funcionalidad del plan', () => {
    mocks.permissions = ['dashboard.view', 'features.cash', 'cash.view', 'petty_cash.manage'];
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Caja menor' })).toHaveAttribute(
      'href',
      '/dashboard/caja/menor'
    );
  });

  it('no aparece sin el permiso o sin la funcionalidad', () => {
    mocks.permissions = ['dashboard.view', 'features.cash', 'cash.view', 'cash.operate'];
    const first = render(<Sidebar />);
    expect(screen.queryByRole('link', { name: 'Caja menor' })).not.toBeInTheDocument();
    first.unmount();

    mocks.permissions = ['dashboard.view', 'cash.view', 'petty_cash.manage'];
    render(<Sidebar />);
    expect(screen.queryByRole('link', { name: 'Caja menor' })).not.toBeInTheDocument();
  });
});
