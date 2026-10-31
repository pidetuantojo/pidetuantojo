// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

import { RID, seedCashWorld, type CashWorld } from './cashFixture';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

const { requirePermission, AuthError } = vi.hoisted(() => {
  class AuthError extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message);
    }
  }
  return { requirePermission: vi.fn(), AuthError };
});
vi.mock('@/lib/auth/serverAuth', () => ({
  AuthError,
  requirePermission,
  errorResponse: (e: InstanceType<typeof AuthError>) =>
    Response.json({ error: e.message }, { status: e.status }),
}));

type Handler = (req: Request, ctx: { params: Record<string, string> }) => Promise<Response>;
const routes: Record<string, Record<string, Handler>> = {};
beforeAll(async () => {
  routes.settings = (await import('@/app/api/cash/settings/route')) as never;
  routes.registers = (await import('@/app/api/cash/registers/route')) as never;
  routes.register = (await import('@/app/api/cash/registers/[registerId]/route')) as never;
  routes.shifts = (await import('@/app/api/cash/shifts/route')) as never;
  routes.current = (await import('@/app/api/cash/shifts/current/route')) as never;
  routes.movements = (await import('@/app/api/cash/shifts/[shiftId]/movements/route')) as never;
  routes.decide =
    (await import('@/app/api/cash/shifts/[shiftId]/movements/[movementId]/approve/route')) as never;
  routes.startClose = (await import('@/app/api/cash/shifts/[shiftId]/start-close/route')) as never;
  routes.count = (await import('@/app/api/cash/shifts/[shiftId]/count/route')) as never;
  routes.approve = (await import('@/app/api/cash/shifts/[shiftId]/approve/route')) as never;
  routes.closing = (await import('@/app/api/cash/shifts/[shiftId]/closing/route')) as never;
  routes.reverse = (await import('@/app/api/cash/movements/[movementId]/reverse/route')) as never;
});

let world: CashWorld;
const caller = (uid: string, permissions: string[] = []) => ({
  uid,
  role: 'restaurant_admin',
  restaurantId: RID,
  isActive: true,
  permissions,
});
const as = (uid: string, permissions: string[] = []) =>
  requirePermission.mockResolvedValue(caller(uid, permissions));

let keySeq = 0;
const call = (
  group: string,
  method: string,
  opts: { body?: unknown; params?: Record<string, string>; key?: boolean; query?: string } = {}
) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.key !== false && method !== 'GET') {
    headers['Idempotency-Key'] = `route-key-${String(++keySeq).padStart(6, '0')}`;
  }
  const req = new Request(`http://localhost/api/cash/x${opts.query ?? ''}`, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  return routes[group][method](req, { params: opts.params ?? {} });
};

beforeEach(async () => {
  db.docs.clear();
  world = await seedCashWorld(db, {
    setup: await import('@/lib/ledger/setup.server'),
    accounts: await import('@/lib/ledger/accounts.server'),
    registers: await import('@/lib/cash/registers.server'),
    settings: await import('@/lib/cash/settings.server'),
  });
  requirePermission.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const openShift = async (uid = 'cashier1') => {
  as(uid, ['cash.operate']);
  const res = await call('shifts', 'POST', {
    body: { registerId: world.ids.reg1, openingCount: { BILLETE_100000: 1 } },
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
};

describe('autenticación, permisos y plan', () => {
  it('401 sin token en cada ruta', async () => {
    requirePermission.mockRejectedValue(new AuthError('No autenticado', 401));
    const p = { params: { shiftId: 's', movementId: 'm', registerId: 'r' } };
    const responses = await Promise.all([
      call('settings', 'GET'),
      call('registers', 'GET'),
      call('shifts', 'GET'),
      call('shifts', 'POST', { body: {} }),
      call('current', 'GET'),
      call('movements', 'POST', { body: {}, ...p }),
      call('startClose', 'POST', p),
      call('count', 'POST', { body: {}, ...p }),
      call('approve', 'POST', { body: {}, ...p }),
      call('closing', 'GET', p),
      call('reverse', 'POST', { body: {}, ...p }),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(11).fill(401));
  });

  it('pide el permiso correcto en cada ruta', async () => {
    requirePermission.mockRejectedValue(new AuthError('No tienes permiso para esta acción', 403));
    const p = { params: { shiftId: 's', movementId: 'm', registerId: 'r' } };
    const expectPerm = async (run: () => Promise<Response>, permission: string) => {
      const res = await run();
      expect(res.status).toBe(403);
      expect(requirePermission).toHaveBeenLastCalledWith(expect.anything(), permission);
    };
    await expectPerm(() => call('settings', 'GET'), 'cash.view');
    await expectPerm(() => call('settings', 'PUT', { body: {} }), 'cash.registers.manage');
    await expectPerm(() => call('registers', 'POST', { body: {} }), 'cash.registers.manage');
    await expectPerm(() => call('register', 'PATCH', { body: {}, ...p }), 'cash.registers.manage');
    await expectPerm(() => call('shifts', 'GET'), 'cash.approve');
    await expectPerm(() => call('shifts', 'POST', { body: {} }), 'cash.operate');
    await expectPerm(() => call('movements', 'POST', { body: {}, ...p }), 'cash.operate');
    await expectPerm(() => call('decide', 'POST', { body: {}, ...p }), 'cash.approve');
    await expectPerm(() => call('count', 'POST', { body: {}, ...p }), 'cash.operate');
    await expectPerm(() => call('approve', 'POST', { body: {}, ...p }), 'cash.approve');
    await expectPerm(() => call('closing', 'GET', p), 'cash.approve');
    await expectPerm(() => call('reverse', 'POST', { body: {}, ...p }), 'cash.reverse');
  });

  it('gate estricto: planes sin features.cash o sin planFeatures reciben 403', async () => {
    as('cashier1', ['cash.operate']);
    db.set(`restaurants/${RID}`, { planFeatures: ['features.printing'] });
    expect((await call('shifts', 'POST', { body: {} })).status).toBe(403);
    db.set(`restaurants/${RID}`, {});
    const res = await call('current', 'GET');
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/plan/i);
  });
});

describe('validación', () => {
  it('400 sin Idempotency-Key o con cuerpo inválido', async () => {
    as('cashier1', ['cash.operate']);
    expect((await call('shifts', 'POST', { body: {}, key: false })).status).toBe(400);
    expect((await call('shifts', 'POST', { body: { registerId: 'x' } })).status).toBe(400);
    expect(
      (
        await call('shifts', 'POST', {
          body: { registerId: world.ids.reg1, openingCount: { BILLETE_1000: -1 } },
        })
      ).status
    ).toBe(400);
    expect(
      (
        await call('shifts', 'POST', {
          body: { registerId: world.ids.reg1, openingCount: {}, extra: 1 },
        })
      ).status
    ).toBe(400);
  });

  it('400 en movimientos: monto no entero, tipo inválido, motivo corto', async () => {
    const shift = await openShift();
    const params = { shiftId: shift.id };
    const bad = [
      { type: 'EGRESO', amount: 10.5, reason: 'compra de hielo' },
      { type: 'EGRESO', amount: 0, reason: 'compra de hielo' },
      { type: 'VENTA', amount: 1000, reason: 'compra de hielo' },
      { type: 'EGRESO', amount: 1000, reason: 'ab' },
    ];
    for (const body of bad) {
      expect((await call('movements', 'POST', { body, params })).status).toBe(400);
    }
  });

  it('crea un egreso válido y no expone la auditoría', async () => {
    const shift = await openShift();
    const res = await call('movements', 'POST', {
      body: { type: 'EGRESO', amount: 5000, reason: 'compra de hielo' },
      params: { shiftId: shift.id },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ type: 'EGRESO', receiptNumber: 'CE-000001' });
    expect(body.audit).toBeUndefined();
  });

  it('400 al rechazar un retiro sin motivo y en reversos sin motivo', async () => {
    as('sup1', ['cash.approve', 'cash.reverse']);
    const p = { params: { shiftId: 's', movementId: 'm' } };
    expect((await call('decide', 'POST', { body: { decision: 'RECHAZAR' }, ...p })).status).toBe(
      400
    );
    expect((await call('reverse', 'POST', { body: { reason: 'abc' }, ...p })).status).toBe(400);
  });
});

describe('cierre a ciegas por API', () => {
  const countBody = (extra: object = {}) => ({ cashCount: { BILLETE_50000: 1 }, ...extra });

  it('la respuesta al cajero solo trae shiftId y status (nunca esperado ni diferencias)', async () => {
    const shift = await openShift();
    const params = { shiftId: shift.id };

    as('cashier1', ['cash.operate']);
    const missing = await call('count', 'POST', { body: countBody(), params });
    expect(missing.status).toBe(400);
    const missingText = await missing.text();
    expect(missingText).not.toMatch(/esperad|diferencia|50000|100000/i);

    const res = await call('count', 'POST', {
      body: countBody({ justification: 'se perdió un billete' }),
      params,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ shiftId: shift.id, status: 'CERRADO_PENDIENTE_APROBACION' });
    expect(JSON.stringify(body)).not.toMatch(/expected|difference|cashDifference/i);

    // el cajero queda libre: ya no tiene turno vigente (la caja sigue bloqueada hasta aprobar)
    const current = await (await call('current', 'GET')).json();
    expect(current.shift).toBeNull();
  });

  it('aprobación: el cajero recibe 403; el supervisor cierra; solo supervisores ven el cierre', async () => {
    const shift = await openShift();
    const params = { shiftId: shift.id };
    as('cashier1', ['cash.operate', 'cash.approve']);
    await call('count', 'POST', { body: countBody({ justification: 'faltó dinero' }), params });

    const self = await call('approve', 'POST', {
      body: { decision: 'APROBAR', note: 'yo mismo' },
      params,
    });
    expect(self.status).toBe(403);

    as('sup1', ['cash.approve']);
    const ok = await call('approve', 'POST', {
      body: {
        decision: 'APROBAR',
        note: 'revisado con cámaras',
        shortageAccountId: world.ids.accExpense,
      },
      params,
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe('CERRADO');

    const closing = await call('closing', 'GET', { params });
    expect(closing.status).toBe(200);
    const snapshot = (await closing.json()).closing;
    expect(snapshot).toMatchObject({
      cashDifference: -50000,
      expectedByMethod: { efectivo: 100000 },
    });
  });

  it('400 en la aprobación sin nota o con decisión distinta', async () => {
    as('sup1', ['cash.approve']);
    const params = { shiftId: 's' };
    expect((await call('approve', 'POST', { body: { decision: 'APROBAR' }, params })).status).toBe(
      400
    );
    expect(
      (
        await call('approve', 'POST', {
          body: { decision: 'RECHAZAR', note: 'nota larga' },
          params,
        })
      ).status
    ).toBe(400);
  });

  it('start-close por el cajero devuelve EN_CIERRE y bloquea movimientos con 409', async () => {
    const shift = await openShift();
    const params = { shiftId: shift.id };
    as('cashier1', ['cash.operate']);
    const res = await call('startClose', 'POST', { params });
    expect(await res.json()).toEqual({ shiftId: shift.id, status: 'EN_CIERRE' });
    const blocked = await call('movements', 'POST', {
      body: { type: 'EGRESO', amount: 1000, reason: 'compra de hielo' },
      params,
    });
    expect(blocked.status).toBe(409);
  });
});

describe('cajas y ajustes', () => {
  it('lista cajas y ajustes; valida y crea una caja', async () => {
    as('viewer', ['cash.view']);
    const list = await (await call('registers', 'GET')).json();
    expect(list.registers).toHaveLength(3);
    const settings = await (await call('settings', 'GET')).json();
    expect(settings.settings.defaultGeneralRegisterId).toBe(world.ids.general);
    expect(settings.settings.denominations).toHaveLength(12);

    as('admin', ['cash.registers.manage']);
    const bad = await call('registers', 'POST', {
      body: { type: 'REGISTRADORA', name: 'Caja 3', ledgerAccountId: world.ids.accExpense },
    });
    expect(bad.status).toBe(400);
    const good = await call('registers', 'POST', {
      body: {
        type: 'REGISTRADORA',
        name: 'Caja 3',
        ledgerAccountId: world.ids.accReg1,
        diffThreshold: 500,
      },
    });
    expect(good.status).toBe(201);
  });
});
