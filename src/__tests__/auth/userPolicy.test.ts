import { describe, it, expect } from 'vitest';

import { canManageRestaurantTeam, canManageUser } from '@/lib/auth/userPolicy';

const superAdmin = { role: 'super_admin' as const };
const adminA = { uid: 'admA', role: 'restaurant_admin' as const, restaurantId: 'A', permissions: ['team.view', 'team.update'] };
const employeeA = { uid: 'e1', role: 'restaurant_employee' as const, restaurantId: 'A' };

describe('canManageUser', () => {
  it('el super admin administra a cualquiera', () => {
    expect(canManageUser(superAdmin, { role: 'restaurant_admin', restaurantId: 'B' })).toBe(true);
    expect(canManageUser(superAdmin, { role: 'super_admin' })).toBe(true);
  });

  it('el admin administra empleados de su restaurante (rol nuevo y legado)', () => {
    expect(canManageUser(adminA, { uid: 'x', role: 'restaurant_employee', restaurantId: 'A' })).toBe(true);
    expect(canManageUser(adminA, { uid: 'y', role: 'restaurant_view', restaurantId: 'A' })).toBe(true);
  });

  it('el admin NO administra empleados de otro restaurante', () => {
    expect(canManageUser(adminA, { role: 'restaurant_employee', restaurantId: 'B' })).toBe(false);
  });

  it('el admin NO administra a otro admin ni al super admin', () => {
    expect(canManageUser(adminA, { role: 'restaurant_admin', restaurantId: 'A' })).toBe(false);
    expect(canManageUser(adminA, { role: 'super_admin' })).toBe(false);
  });

  it('nadie se administra a sí mismo desde Equipo', () => {
    const empManager = { ...employeeA, permissions: ['team.view', 'team.update'] };
    expect(canManageUser(empManager, { uid: 'e1', role: 'restaurant_employee', restaurantId: 'A', effectivePermissions: [] })).toBe(false);
  });

  it('un empleado con permisos de equipo administra a empleados con menos o iguales permisos', () => {
    const manager = { ...employeeA, permissions: ['team.view', 'team.update', 'orders.view', 'orders.change_status'] };
    expect(canManageUser(manager, { uid: 'e2', role: 'restaurant_employee', restaurantId: 'A', effectivePermissions: ['orders.view'] })).toBe(true);
  });

  it('un empleado NO administra a alguien con más permisos que él', () => {
    const manager = { ...employeeA, permissions: ['team.view', 'team.update', 'orders.view'] };
    expect(canManageUser(manager, { uid: 'e2', role: 'restaurant_employee', restaurantId: 'A', effectivePermissions: ['orders.view', 'accounting.view'] })).toBe(false);
  });

  it('un admin sin restaurante asignado no administra a nadie', () => {
    expect(canManageUser({ role: 'restaurant_admin' }, { role: 'restaurant_employee' })).toBe(false);
  });
});

describe('canManageRestaurantTeam', () => {
  it('el super admin ve el equipo de cualquier restaurante', () => {
    expect(canManageRestaurantTeam(superAdmin, 'B')).toBe(true);
  });

  it('requiere team.view y ser del mismo restaurante', () => {
    expect(canManageRestaurantTeam(adminA, 'A')).toBe(true);
    expect(canManageRestaurantTeam(adminA, 'B')).toBe(false);
    expect(canManageRestaurantTeam({ ...employeeA, permissions: ['orders.view'] }, 'A')).toBe(false);
    expect(canManageRestaurantTeam({ ...employeeA, permissions: ['team.view'] }, 'A')).toBe(true);
  });
});
