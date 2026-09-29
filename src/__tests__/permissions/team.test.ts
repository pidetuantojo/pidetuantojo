import { describe, it, expect } from 'vitest';

import { canAddEmployee, employeeLimit, LEGACY_MAX_EMPLOYEES } from '@/lib/permissions/team';

describe('límite de empleados', () => {
  it('sin plan: límite histórico', () => {
    expect(employeeLimit(null, false)).toBe(LEGACY_MAX_EMPLOYEES);
  });

  it('con plan: el del plan, o sin límite si no lo define', () => {
    expect(employeeLimit({ limits: { maxEmployees: 5 } }, true)).toBe(5);
    expect(employeeLimit({ limits: {} }, true)).toBe(null);
    expect(employeeLimit({}, true)).toBe(null);
  });

  it('canAddEmployee', () => {
    expect(canAddEmployee(1, 2)).toBe(true);
    expect(canAddEmployee(2, 2)).toBe(false);
    expect(canAddEmployee(999, null)).toBe(true);
  });
});
