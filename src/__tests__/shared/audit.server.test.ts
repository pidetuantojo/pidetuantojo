import { describe, it, expect, beforeAll, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

let mod: typeof import('@/lib/shared/audit.server');
beforeAll(async () => {
  mod = await import('@/lib/shared/audit.server');
});

const req = (headers: Record<string, string>) =>
  new Request('http://localhost/x', { method: 'POST', body: '{"secreto":"no guardar"}', headers });

describe('buildAuditContext', () => {
  it('toma la primera IP de x-forwarded-for y la fecha contable de Bogotá', () => {
    const ctx = mod.buildAuditContext(
      req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1', 'user-agent': 'Vitest/1.0' }),
      { uid: 'u1' },
      { registerId: 'reg1', reason: 'cierre' }
    );
    expect(ctx).toMatchObject({
      uid: 'u1',
      ip: '1.2.3.4',
      userAgent: 'Vitest/1.0',
      registerId: 'reg1',
      reason: 'cierre',
    });
    expect(ctx.accountingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(ctx.at).toISOString()).toBe(ctx.at);
    expect('shiftId' in ctx).toBe(false);
  });

  it('usa x-real-ip si no hay x-forwarded-for, y null si no hay ninguno', () => {
    expect(mod.buildAuditContext(req({ 'x-real-ip': '5.6.7.8' }), { uid: 'u' }).ip).toBe('5.6.7.8');
    expect(mod.buildAuditContext(req({}), { uid: 'u' }).ip).toBeNull();
  });

  it('trunca el user-agent a 200 caracteres', () => {
    const ctx = mod.buildAuditContext(req({ 'user-agent': 'a'.repeat(500) }), { uid: 'u' });
    expect(ctx.userAgent).toHaveLength(200);
  });
});

describe('writeAuditLog', () => {
  it('crea un documento con ID automático y sin el cuerpo de la petición', async () => {
    const context = mod.buildAuditContext(req({ 'x-real-ip': '9.9.9.9' }), { uid: 'u1' });
    const id = await db.runTransaction(async (tx) =>
      mod.writeAuditLog(tx as never, 'r1', {
        action: 'shift.open',
        entityType: 'shift',
        entityId: 's1',
        context,
        data: { openingAmount: 50000 },
      })
    );
    const stored = db.get(`restaurants/r1/auditLog/${id}`);
    expect(stored).toMatchObject({
      action: 'shift.open',
      entityId: 's1',
      data: { openingAmount: 50000 },
    });
    expect(JSON.stringify(stored)).not.toContain('secreto');
  });
});
