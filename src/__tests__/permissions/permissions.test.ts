import { describe, it, expect } from 'vitest';

import {
  LEGACY_EMPLOYEE_PERMISSIONS,
  PERMISSION_MODULES,
  PERMISSION_TEMPLATES,
  type Permission,
} from '@/constants/permissions';
import {
  ALL_PERMISSIONS,
  FEATURE_PERMISSIONS,
  USER_PERMISSIONS,
  can,
  dependentsOf,
  isSelectable,
  togglePermission,
  canAccessPath,
  canAll,
  canAny,
  computeEffectivePermissions,
  dropUnsatisfied,
  expandRequires,
  firstAllowedRoute,
  grantablePermissions,
  isEmployeeRole,
  isPermission,
  legacyPermissions,
  normalizePermissions,
  requiredPermissionForPath,
  ROUTE_PERMISSIONS,
  validateGrant,
} from '@/lib/permissions/permissions';

describe('catálogo de permisos (integridad)', () => {
  it('no tiene claves repetidas', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it('las dependencias (requires) apuntan a permisos que existen', () => {
    for (const mod of PERMISSION_MODULES) {
      for (const p of mod.permissions) {
        for (const dep of ('requires' in p ? p.requires : [])) {
          expect(isPermission(dep), `${p.key} requiere ${dep}`).toBe(true);
        }
      }
    }
  });

  it('no hay dependencias circulares', () => {
    // expandRequires terminaría igual, pero un ciclo es un error de diseño del catálogo
    const requiresOf = new Map<string, readonly string[]>(
      PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => [p.key, 'requires' in p ? p.requires : []] as const))
    );
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (k: string): void => {
      if (done.has(k)) return;
      expect(visiting.has(k), `ciclo en ${k}`).toBe(false);
      visiting.add(k);
      (requiresOf.get(k) ?? []).forEach(visit);
      visiting.delete(k);
      done.add(k);
    };
    ALL_PERMISSIONS.forEach(visit);
  });

  it('cada módulo de usuario tiene su permiso *.view o equivalente como primero', () => {
    for (const mod of PERMISSION_MODULES.filter((m) => m.kind === 'user')) {
      expect(mod.permissions[0].key.endsWith('.view') || mod.permissions[0].key.endsWith('.run'), mod.id).toBe(true);
    }
  });

  it('separa permisos de usuario y funcionalidades', () => {
    expect(FEATURE_PERMISSIONS.every((p) => p.startsWith('features.'))).toBe(true);
    expect(USER_PERMISSIONS.some((p) => p.startsWith('features.'))).toBe(false);
    expect(FEATURE_PERMISSIONS.length + USER_PERMISSIONS.length).toBe(ALL_PERMISSIONS.length);
  });

  it('plantillas, permisos legados y rutas usan claves válidas', () => {
    PERMISSION_TEMPLATES.forEach((t) => t.permissions.forEach((p) => expect(isPermission(p), `${t.id}: ${p}`).toBe(true)));
    LEGACY_EMPLOYEE_PERMISSIONS.forEach((p) => expect(isPermission(p)).toBe(true));
    ROUTE_PERMISSIONS.forEach((r) => expect(isPermission(r.permission), r.path).toBe(true));
  });
});

describe('expandRequires / normalizePermissions', () => {
  it('agrega dependencias de forma transitiva', () => {
    expect(expandRequires(['products.update'])).toEqual(['products.view', 'products.update', 'categories.view']);
  });

  it('orders.print trae orders.view y la funcionalidad de impresión', () => {
    expect(expandRequires(['orders.print'])).toEqual(expect.arrayContaining(['orders.view', 'features.printing']));
  });

  it('normalizePermissions descarta claves desconocidas y duplicados', () => {
    expect(normalizePermissions(['addons.view', 'no.existe', 42, 'addons.view'])).toEqual(['addons.view']);
    expect(normalizePermissions(undefined)).toEqual([]);
  });
});

describe('dropUnsatisfied', () => {
  it('quita permisos cuyas dependencias no están', () => {
    expect(dropUnsatisfied(['orders.view', 'orders.print'])).toEqual(['orders.view']);
  });

  it('propaga en cadena', () => {
    // sin features.printing cae printers.view, y con él printers.manage
    expect(dropUnsatisfied(['printers.view', 'printers.manage'])).toEqual([]);
  });
});

describe('can / canAny / canAll', () => {
  const perms = ['orders.view', 'orders.change_status'];
  it('consulta permisos', () => {
    expect(can(perms, 'orders.view')).toBe(true);
    expect(can(perms, 'orders.edit')).toBe(false);
    expect(can(null, 'orders.view')).toBe(false);
    expect(canAny(perms, ['orders.edit', 'orders.view'])).toBe(true);
    expect(canAll(perms, ['orders.edit', 'orders.view'])).toBe(false);
  });
});

describe('computeEffectivePermissions', () => {
  const basicPlan: Permission[] = ['orders.view', 'orders.change_status', 'orders.edit', 'products.view', 'categories.view', 'features.scheduled_orders'];

  it('super admin: todo', () => {
    expect(computeEffectivePermissions({ role: 'super_admin', planPermissions: [] })).toEqual([...ALL_PERMISSIONS]);
  });

  it('admin: exactamente el plan (normalizado)', () => {
    expect(computeEffectivePermissions({ role: 'restaurant_admin', planPermissions: basicPlan }))
      .toEqual(normalizePermissions(basicPlan));
  });

  it('restaurante sin plan (anterior al sistema): acceso completo', () => {
    expect(computeEffectivePermissions({ role: 'restaurant_admin', planPermissions: null })).toEqual([...ALL_PERMISSIONS]);
  });

  it('empleado: otorgados ∩ plan + funcionalidades del plan', () => {
    const eff = computeEffectivePermissions({
      role: 'restaurant_employee',
      planPermissions: basicPlan,
      grantedPermissions: ['orders.change_status', 'accounting.view'], // accounting no está en el plan
    });
    expect(eff).toEqual(['orders.view', 'orders.change_status', 'features.scheduled_orders']);
  });

  it('empleado con fullAccess: todos los permisos del plan', () => {
    const eff = computeEffectivePermissions({ role: 'restaurant_employee', planPermissions: basicPlan, fullAccess: true });
    expect(eff).toEqual(normalizePermissions(basicPlan));
  });

  it('el rol legado restaurant_view se trata como empleado', () => {
    expect(isEmployeeRole('restaurant_view')).toBe(true);
    const eff = computeEffectivePermissions({ role: 'restaurant_view', planPermissions: basicPlan, grantedPermissions: ['orders.view'] });
    expect(eff).toContain('orders.view');
  });

  it('un empleado nunca recibe funcionalidades que el plan no tiene aunque se las otorguen', () => {
    const eff = computeEffectivePermissions({ role: 'restaurant_employee', planPermissions: basicPlan, grantedPermissions: ['features.printing', 'orders.print'] });
    expect(eff).not.toContain('features.printing');
    expect(eff).not.toContain('orders.print');
  });

  it('si el plan baja, el empleado pierde lo que ya no incluye', () => {
    const before = computeEffectivePermissions({ role: 'restaurant_employee', planPermissions: basicPlan, grantedPermissions: ['orders.edit'] });
    const after = computeEffectivePermissions({ role: 'restaurant_employee', planPermissions: ['orders.view'], grantedPermissions: ['orders.edit'] });
    expect(before).toContain('orders.edit');
    expect(after).not.toContain('orders.edit');
  });
});

describe('otorgar permisos (sin escalamiento)', () => {
  const plan = normalizePermissions(['orders.edit', 'orders.change_status', 'accounting.export', 'team.update', 'features.printing']);

  it('grantable = permisos de usuario de quien otorga ∩ plan', () => {
    const granter = ['orders.view', 'orders.change_status', 'team.view', 'team.update', 'accounting.view', 'accounting.export', 'settings.view'];
    expect(grantablePermissions(granter, plan)).toEqual(
      expect.arrayContaining(['orders.view', 'orders.change_status', 'accounting.export', 'team.update'])
    );
    // settings.view lo tiene quien otorga pero no el plan
    expect(grantablePermissions(granter, plan)).not.toContain('settings.view');
    // features.* nunca son otorgables
    expect(grantablePermissions([...granter, 'features.printing'], plan)).not.toContain('features.printing');
  });

  it('validateGrant devuelve lo que no se puede otorgar (ya expandido)', () => {
    const granter = ['orders.view', 'orders.change_status', 'team.view', 'team.update'];
    // orders.edit no lo tiene quien otorga; y trae products.view que tampoco tiene
    expect(validateGrant(['orders.change_status', 'orders.edit'], granter, plan)).toEqual(
      expect.arrayContaining(['orders.edit', 'products.view'])
    );
    expect(validateGrant(['orders.change_status'], granter, plan)).toEqual([]);
  });
});

describe('rutas', () => {
  it('resuelve el permiso más específico', () => {
    expect(requiredPermissionForPath('/dashboard')).toBe('dashboard.view');
    expect(requiredPermissionForPath('/dashboard/productos')).toBe('products.view');
    expect(requiredPermissionForPath('/dashboard/productos/nuevo')).toBe('products.create');
    expect(requiredPermissionForPath('/dashboard/productos/abc123')).toBe('products.update');
    expect(requiredPermissionForPath('/dashboard/configuracion/impresoras')).toBe('printers.view');
    expect(requiredPermissionForPath('/dashboard/configuracion')).toBe('settings.view');
    expect(requiredPermissionForPath('/dashboard/pedidos/')).toBe('orders.view');
  });

  it('rutas no registradas no exigen permiso (ej. redirecciones legadas)', () => {
    expect(requiredPermissionForPath('/dashboard/menu')).toBe(null);
  });

  it('canAccessPath y firstAllowedRoute', () => {
    const cook = ['orders.view', 'orders.change_status'];
    expect(canAccessPath(cook, '/dashboard/pedidos')).toBe(true);
    expect(canAccessPath(cook, '/dashboard/contabilidad')).toBe(false);
    expect(firstAllowedRoute(cook)).toBe('/dashboard/pedidos');
    expect(firstAllowedRoute(['print_station.run', 'features.printing'])).toBe('/dashboard/estacion-impresion');
    expect(firstAllowedRoute(['dashboard.view', 'orders.view'])).toBe('/dashboard');
    expect(firstAllowedRoute([])).toBe(null);
  });
});

describe('legacyPermissions', () => {
  it('admin sin migrar: todo; empleado sin migrar: lo que podía hacer antes', () => {
    expect(legacyPermissions('restaurant_admin')).toEqual([...ALL_PERMISSIONS]);
    const emp = legacyPermissions('restaurant_view');
    expect(emp).toEqual(expect.arrayContaining(['orders.view', 'orders.change_status', 'accounting.view', 'print_station.run']));
    expect(emp).not.toContain('orders.edit');
    expect(emp).not.toContain('settings.view');
  });
});

describe('editor: togglePermission / dependentsOf / isSelectable', () => {
  it('marcar agrega dependencias', () => {
    expect(togglePermission([], 'orders.edit', true)).toEqual(['orders.view', 'orders.edit', 'products.view']);
  });

  it('desmarcar quita lo que depende (en cadena)', () => {
    const current = expandRequires(['orders.edit', 'orders.print', 'orders.change_status']);
    expect(togglePermission(current, 'orders.view', false)).toEqual(['products.view', 'features.printing']);
  });

  it('no marca si una dependencia no está disponible (ej. plan sin impresión)', () => {
    const available = expandRequires(['orders.view', 'orders.change_status']);
    expect(togglePermission(['orders.view'], 'orders.print', true, available)).toEqual(['orders.view']);
    expect(isSelectable('orders.print', available)).toBe(false);
    expect(isSelectable('orders.change_status', available)).toBe(true);
  });

  it('dependentsOf incluye dependientes indirectos', () => {
    expect(dependentsOf('features.printing')).toEqual(expect.arrayContaining(['orders.print', 'printers.view', 'printers.manage', 'print_station.run']));
  });
});
