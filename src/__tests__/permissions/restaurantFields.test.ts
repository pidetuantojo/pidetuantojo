import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LEGACY_EMPLOYEE_PERMISSIONS, type Permission } from '@/constants/permissions';
import { expandRequires } from '@/lib/permissions/permissions';
import { RESTAURANT_FIELD_GROUPS, pickEditableRestaurantFields } from '@/lib/permissions/restaurantFields';

const rules = readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8');

/** Strings entre comillas simples dentro del cuerpo de la función `name` de firestore.rules. */
function quotedInFunction(name: string): string[] {
  const start = rules.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const end = rules.indexOf('\n    }\n', start);
  return Array.from(rules.slice(start, end).matchAll(/'([^']+)'/g), (m) => m[1]);
}

describe('pickEditableRestaurantFields', () => {
  const data = { name: 'A', phone: '1', logo: 'x', deliveryMode: 'zones', isActive: true, slug: 's' };

  it('deja solo los campos de las secciones permitidas', () => {
    const can = (p: Permission) => p === 'settings.update_info';
    expect(pickEditableRestaurantFields(data, can)).toEqual({ name: 'A', phone: '1' });
  });

  it('nunca incluye campos del super admin (slug, isActive)', () => {
    const out = pickEditableRestaurantFields(data, () => true);
    expect(out).not.toHaveProperty('slug');
    expect(out).not.toHaveProperty('isActive');
    expect(out).toMatchObject({ name: 'A', logo: 'x', deliveryMode: 'zones' });
  });

  it('sin permisos no envía nada', () => {
    expect(pickEditableRestaurantFields(data, () => false)).toEqual({});
  });
});

describe('firestore.rules en sincronía con el código', () => {
  it('los campos editables del restaurante coinciden', () => {
    const inRules = new Set(quotedInFunction('restaurantUpdateAllowed').filter((s) => !s.includes('.')));
    inRules.delete('updatedAt');
    const inCode = new Set(Object.values(RESTAURANT_FIELD_GROUPS).flat());
    expect(Array.from(inRules).sort()).toEqual(Array.from(inCode).sort());
  });

  it('cada grupo de campos exige su permiso en las reglas', () => {
    const body = quotedInFunction('restaurantUpdateAllowed').join(' ');
    for (const permission of Object.keys(RESTAURANT_FIELD_GROUPS)) {
      expect(body).toContain(permission);
    }
  });

  it('la lista legacy de empleados coincide con LEGACY_EMPLOYEE_PERMISSIONS (+ requires)', () => {
    const inRules = quotedInFunction('legacyEmployeePermissions').sort();
    const inCode = [...expandRequires(LEGACY_EMPLOYEE_PERMISSIONS)].sort();
    expect(inRules).toEqual(inCode);
  });
});
