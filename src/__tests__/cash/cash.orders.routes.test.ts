// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

import { RID, seedCashWorld, seedOrder, type CashWorld } from './cashFixture';

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
  routes.shifts = (await import('@/app/api/cash/shifts/route')) as never;
  routes.shiftMovements =
    (await import('@/app/api/cash/shifts/[shiftId]/movements/route')) as never;
  routes.pay = (await import('@/app/api/cash/order-payments/route')) as never;
  routes.reversePayment =
    (await import('@/app/api/cash/order-payments/[orderId]/payments/[paymentId]/reverse/route')) as never;
  routes.refunds = (await import('@/app/api/cash/refunds/route')) as never;
  routes.deposits = (await import('@/app/api/cash/deposits/route')) as never;
  routes.settlements = (await import('@/app/api/cash/settlements/route')) as never;
  routes.generalMovements =
    (await import('@/app/api/cash/registers/[registerId]/movements/route')) as never;
  routes.balance = (await import('@/app/api/cash/registers/[registerId]/balance/route')) as never;
});

let world: CashWorld;
const caller = (uid: string, permissions: string[]) => ({
  uid,
  role: 'restaurant_admin',
  restaurantId: RID,
  isActive: true,
  permissions,
});
const as = (uid: string, permissions: string[]) =>
  requirePermission.mockResolvedValue(caller(uid, permissions));

let keySeq = 0;
const call = (
  group: string,
  method: string,
  opts: { body?: unknown; params?: Record<string, string>; key?: boolean } = {}
) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.key !== false && method !== 'GET') {
    headers['Idempotency-Key'] = `route-key-${String(++keySeq).padStart(6, '0')}`;
  }
  const req = new Request('http://localhost/api/cash/x', {
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
  seedOrder(db, 'o1');
  requirePermission.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const p = { params: { orderId: 'o1', paymentId: 'x', registerId: 'r', shiftId: 's' } };
const NEW_ROUTES: [string, string, string][] = [
  ['pay', 'POST', 'cash.operate'],
  ['reversePayment', 'POST', 'cash.reverse'],
  ['refunds', 'POST', 'cash.reverse'],
  ['deposits', 'POST', 'cash.approve'],
  ['settlements', 'POST', 'cash.approve'],
  ['generalMovements', 'POST', 'cash.approve'],
  ['balance', 'GET', 'cash.approve'],
  ['shiftMovements', 'GET', 'cash.view'],
];

describe('rutas de la fase 2b: autenticación y permisos', () => {
  it('401 sin token en cada ruta nueva', async () => {
    requirePermission.mockRejectedValue(new AuthError('No autenticado', 401));
    for (const [group, method] of NEW_ROUTES) {
      const res = await call(group, method, { body: method === 'POST' ? {} : undefined, ...p });
      expect(res.status, group).toBe(401);
    }
  });

  it('403 y permiso correcto en cada ruta nueva', async () => {
    requirePermission.mockRejectedValue(new AuthError('No tienes permiso para esta acción', 403));
    for (const [group, method, permission] of NEW_ROUTES) {
      const res = await call(group, method, { body: method === 'POST' ? {} : undefined, ...p });
      expect(res.status, group).toBe(403);
      expect(requirePermission).toHaveBeenLastCalledWith(expect.anything(), permission);
    }
  });

  it('elegir la contrapartida exige además ledger.manage', async () => {
    as('acc1', ['cash.approve']);
    const body = {
      type: 'INGRESO_VARIO',
      amount: 1000,
      reason: 'saldo inicial',
      accountOverrideId: world.ids.accEquity,
    };
    const params = { registerId: world.ids.general };
    expect((await call('generalMovements', 'POST', { body, params })).status).toBe(403);
    as('acc1', ['cash.approve', 'ledger.manage']);
    expect((await call('generalMovements', 'POST', { body, params })).status).toBe(201);
    const balance = await call('balance', 'GET', { params });
    expect(balance.status).toBe(200);
    expect(await balance.json()).toMatchObject({ registerId: world.ids.general, cash: 1000 });
  });
});

describe('rutas de la fase 2b: validación', () => {
  it('400 sin Idempotency-Key o con cuerpo inválido', async () => {
    as('cashier1', ['cash.operate', 'cash.reverse', 'cash.approve']);
    const good = { orderId: 'o1', payments: [{ paymentMethodId: 'pm-nequi', amount: 1000 }] };
    expect((await call('pay', 'POST', { body: good, key: false })).status).toBe(400);
    expect((await call('pay', 'POST', { body: { orderId: 'o1', payments: [] } })).status).toBe(400);
    expect(
      (
        await call('pay', 'POST', {
          body: { orderId: 'o1', payments: [{ paymentMethodId: 'a', amount: 10.5 }] },
        })
      ).status
    ).toBe(400);
    expect((await call('pay', 'POST', { body: { ...good, extra: 1 } })).status).toBe(400);
    expect(
      (
        await call('refunds', 'POST', {
          body: { orderId: 'o1', paymentMethodId: 'a', amount: 5, reason: 'x' },
        })
      ).status
    ).toBe(400);
    expect((await call('deposits', 'POST', { body: { registerId: 'r', amount: 5 } })).status).toBe(
      400
    );
    expect((await call('settlements', 'POST', { body: { amount: -5 } })).status).toBe(400);
    expect((await call('reversePayment', 'POST', { body: { reason: 'no' }, ...p })).status).toBe(
      400
    );
    expect(
      (
        await call('generalMovements', 'POST', {
          body: { type: 'RETIRO_PARCIAL', amount: 5, reason: 'abc de' },
          ...p,
        })
      ).status
    ).toBe(400);
  });

  it('cobro por API: 201 con isPaid; 409 al sobrepasar; el pedido ajeno no existe', async () => {
    as('cashier1', ['cash.operate']);
    const ok = await call('pay', 'POST', {
      body: { orderId: 'o1', payments: [{ paymentMethodId: 'pm-nequi', amount: 50000 }] },
    });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ orderId: 'o1', isPaid: true });
    const over = await call('pay', 'POST', {
      body: { orderId: 'o1', payments: [{ paymentMethodId: 'pm-nequi', amount: 1 }] },
    });
    expect(over.status).toBe(409);
    expect((await over.json()).code).toBe('OVERPAYMENT');
    const missing = await call('pay', 'POST', {
      body: { orderId: 'nope', payments: [{ paymentMethodId: 'pm-nequi', amount: 1 }] },
    });
    expect(missing.status).toBe(404);
  });
});

describe('cierre a ciegas: la lista del turno', () => {
  it('el cajero ve la lista sin totales; un supervisor ve totales; otro cajero no ve el turno', async () => {
    as('cashier1', ['cash.operate']);
    const opened = await call('shifts', 'POST', {
      body: { registerId: world.ids.reg1, openingCount: { BILLETE_100000: 1 } },
    });
    const shift = (await opened.json()) as { id: string };
    const params = { shiftId: shift.id };

    const mine = await call('shiftMovements', 'GET', { params });
    expect(mine.status).toBe(200);
    const mineBody = await mine.json();
    expect(mineBody.movements).toHaveLength(1);
    expect(JSON.stringify(mineBody)).not.toMatch(/totalsByMethod|expected|difference|"audit"/);

    as('sup1', ['cash.view', 'cash.approve']);
    const sup = await (await call('shiftMovements', 'GET', { params })).json();
    expect(sup.totalsByMethod).toEqual({ efectivo: 100000 });

    as('cashier2', ['cash.operate']);
    expect((await call('shiftMovements', 'GET', { params })).status).toBe(404);
  });
});
