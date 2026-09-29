import { describe, expect, it } from 'vitest';

import { LEGACY_EMPLOYEE_PERMISSIONS } from '@/constants/permissions';
import { FULL_PLAN_ID, buildFullPlan, planMigration } from '@/lib/permissions/migration';
import { ALL_PERMISSIONS, computeEffectivePermissions, legacyPermissions } from '@/lib/permissions/permissions';

const restaurants = [
  { id: 'r1', name: 'Uno' },
  { id: 'r2', name: 'Dos', planId: 'basico' },
];

describe('buildFullPlan', () => {
  it('incluye todos los permisos con id fijo', () => {
    const plan = buildFullPlan('2026-09-27T00:00:00.000Z');
    expect(plan.id).toBe(FULL_PLAN_ID);
    expect(plan.permissions).toEqual([...ALL_PERMISSIONS]);
    expect(plan.isActive).toBe(true);
  });
});

describe('planMigration', () => {
  it('asigna el plan Completo solo a restaurantes sin plan y lo crea si no existe', () => {
    const plan = planMigration({ restaurants, users: [], fullPlanExists: false });
    expect(plan.restaurantsToAssign).toEqual([{ id: 'r1', name: 'Uno' }]);
    expect(plan.createFullPlan).toBe(true);
    expect(plan.restaurantsToSync).toEqual(['r1', 'r2']);
  });

  it('no crea el plan si ya existe o si ningún restaurante lo necesita', () => {
    expect(planMigration({ restaurants, users: [], fullPlanExists: true }).createFullPlan).toBe(false);
    expect(planMigration({ restaurants: [restaurants[1]], users: [], fullPlanExists: false }).createFullPlan).toBe(false);
  });

  it('convierte restaurant_view en empleado con los permisos legacy', () => {
    const plan = planMigration({
      restaurants,
      users: [{ uid: 'u1', email: 'caja@x.co', role: 'restaurant_view', restaurantId: 'r1' }],
      fullPlanExists: false,
    });
    expect(plan.usersToConvert).toEqual([
      { uid: 'u1', email: 'caja@x.co', grantedPermissions: [...LEGACY_EMPLOYEE_PERMISSIONS] },
    ]);
    expect(plan.usersPendingSync).toBe(1);
  });

  it('conserva los permisos otorgados si ya los tenía', () => {
    const plan = planMigration({
      restaurants,
      users: [{ uid: 'u1', role: 'restaurant_view', restaurantId: 'r1', grantedPermissions: ['orders.view'] }],
      fullPlanExists: true,
    });
    expect(plan.usersToConvert).toEqual([{ uid: 'u1' }]);
  });

  it('ignora super admin, avisa roles desconocidos y usuarios sin restaurante', () => {
    const plan = planMigration({
      restaurants,
      users: [
        { uid: 's', role: 'super_admin' },
        { uid: 'x', role: 'otro', restaurantId: 'r1' },
        { uid: 'y', email: 'y@x.co', role: 'restaurant_employee', restaurantId: 'borrado' },
        { uid: 'a', role: 'restaurant_admin', restaurantId: 'r2', effectivePermissions: ['orders.view'] },
      ],
      fullPlanExists: true,
    });
    expect(plan.usersToConvert).toEqual([]);
    expect(plan.warnings).toHaveLength(2);
    expect(plan.usersPendingSync).toBe(0);
  });

  it('es idempotente: una segunda corrida no asigna ni convierte nada', () => {
    const plan = planMigration({
      restaurants: [{ id: 'r1', planId: FULL_PLAN_ID }],
      users: [{ uid: 'u1', role: 'restaurant_employee', restaurantId: 'r1', grantedPermissions: ['orders.view'], effectivePermissions: ['orders.view'] }],
      fullPlanExists: true,
    });
    expect(plan.createFullPlan).toBe(false);
    expect(plan.restaurantsToAssign).toEqual([]);
    expect(plan.usersToConvert).toEqual([]);
  });

  it('con el plan Completo nadie pierde acceso respecto al comportamiento legacy', () => {
    const full = buildFullPlan('now').permissions as typeof ALL_PERMISSIONS[number][];
    const admin = computeEffectivePermissions({ role: 'restaurant_admin', planPermissions: full, grantedPermissions: null, fullAccess: false });
    expect([...admin].sort()).toEqual([...legacyPermissions('restaurant_admin')].sort());

    const employee = computeEffectivePermissions({
      role: 'restaurant_employee', planPermissions: full,
      grantedPermissions: [...LEGACY_EMPLOYEE_PERMISSIONS], fullAccess: false,
    });
    for (const p of legacyPermissions('restaurant_view')) expect(employee).toContain(p);
  });
});
