// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestore } from '../../orders/fakeFirestore';
import { RID } from '../cashFixture';

import {
  ATTACHMENT,
  expenseInput,
  FUND,
  loadPettyMods,
  seedPettyWorld,
  type PettyWorld,
} from './pettyFixture';

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
  routes.categories = (await import('@/app/api/cash/petty/categories/route')) as never;
  routes.category = (await import('@/app/api/cash/petty/categories/[categoryId]/route')) as never;
  routes.fund = (await import('@/app/api/cash/petty/[registerId]/fund/route')) as never;
  routes.status = (await import('@/app/api/cash/petty/[registerId]/status/route')) as never;
  routes.expenses = (await import('@/app/api/cash/petty/expenses/route')) as never;
  routes.attach =
    (await import('@/app/api/cash/petty/expenses/[expenseId]/attachments/route')) as never;
  routes.legalize =
    (await import('@/app/api/cash/petty/expenses/[expenseId]/legalize/route')) as never;
  routes.annul = (await import('@/app/api/cash/petty/expenses/[expenseId]/annul/route')) as never;
  routes.reimbursements = (await import('@/app/api/cash/petty/reimbursements/route')) as never;
  routes.approve =
    (await import('@/app/api/cash/petty/reimbursements/[reimbursementId]/approve/route')) as never;
  routes.reject =
    (await import('@/app/api/cash/petty/reimbursements/[reimbursementId]/reject/route')) as never;
});

let w: PettyWorld;
const caller = (uid: string, permissions: string[]) => ({
  uid,
  role: 'restaurant_admin',
  restaurantId: RID,
  isActive: true,
  permissions,
});
const as = (uid: string, permissions: string[]): void => {
  requirePermission.mockImplementation(async (_req: Request, permission: string) => {
    if (!permissions.includes(permission)) {
      throw new AuthError('No tienes permiso para esta acción', 403);
    }
    return caller(uid, permissions);
  });
};

let keySeq = 0;
const call = (
  group: string,
  method: string,
  opts: { body?: unknown; params?: Record<string, string>; key?: boolean; query?: string } = {}
) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.key !== false && method !== 'GET') {
    headers['Idempotency-Key'] = `petty-key-${String(++keySeq).padStart(6, '0')}`;
  }
  const req = new Request(`http://localhost/api/cash/petty/x${opts.query ?? ''}`, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  return routes[group][method](req, { params: opts.params ?? {} });
};

beforeEach(async () => {
  db.docs.clear();
  w = await seedPettyWorld(db, await loadPettyMods());
  requirePermission.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const P = { registerId: 'r', expenseId: 'e', reimbursementId: 'rb', categoryId: 'c' };
const ALL: [string, string, boolean][] = [
  ['categories', 'GET', false],
  ['categories', 'POST', true],
  ['category', 'PATCH', true],
  ['fund', 'POST', true],
  ['status', 'GET', false],
  ['expenses', 'GET', false],
  ['expenses', 'POST', true],
  ['attach', 'POST', true],
  ['legalize', 'POST', true],
  ['annul', 'POST', true],
  ['reimbursements', 'GET', false],
  ['reimbursements', 'POST', true],
  ['approve', 'POST', true],
  ['reject', 'POST', true],
];

describe('autenticación y permisos', () => {
  it('401 sin token en cada ruta', async () => {
    requirePermission.mockRejectedValue(new AuthError('No autenticado', 401));
    const responses = await Promise.all(
      ALL.map(([g, m, hasBody]) => call(g, m, { params: P, ...(hasBody ? { body: {} } : {}) }))
    );
    expect(responses.map((r) => r.status)).toEqual(Array(ALL.length).fill(401));
  });

  it('403 sin ningún permiso de caja menor', async () => {
    as('nobody', ['cash.view']);
    const responses = await Promise.all(
      ALL.map(([g, m, hasBody]) => call(g, m, { params: P, ...(hasBody ? { body: {} } : {}) }))
    );
    expect(responses.map((r) => r.status)).toEqual(Array(ALL.length).fill(403));
  });

  it('operar exige manage y aprobar exige approve', async () => {
    as('op', ['petty_cash.manage']);
    expect((await call('fund', 'POST', { params: P, body: {} })).status).toBe(403);
    expect((await call('approve', 'POST', { params: P, body: {} })).status).toBe(403);
    expect((await call('reject', 'POST', { params: P, body: {} })).status).toBe(403);
    // con manage solo, los POST de operación llegan a validar el cuerpo (400, no 403)
    expect((await call('expenses', 'POST', { body: {} })).status).toBe(400);

    as('boss', ['petty_cash.approve']);
    expect((await call('expenses', 'POST', { body: {} })).status).toBe(403);
    expect((await call('fund', 'POST', { params: P, body: {} })).status).toBe(400);
  });

  it('las lecturas aceptan manage o approve', async () => {
    as('boss', ['petty_cash.approve']);
    const res = await call('status', 'GET', { params: { registerId: w.petty.register } });
    expect(res.status).toBe(200);
    as('op', ['petty_cash.manage']);
    expect(
      (await call('expenses', 'GET', { query: `?registerId=${w.petty.register}` })).status
    ).toBe(200);
  });
});

describe('validación', () => {
  beforeEach(() => {
    as('all', ['petty_cash.manage', 'petty_cash.approve']);
  });

  it('400 sin Idempotency-Key', async () => {
    const res = await call('expenses', 'POST', { body: expenseInput(w, 1000), key: false });
    expect(res.status).toBe(400);
  });

  it('400 con cuerpo inválido en cada POST', async () => {
    const bodies: [string, unknown][] = [
      ['categories', {}],
      ['fund', { targetAmount: 1.5, source: {} }],
      ['expenses', { ...expenseInput(w, 1000), amount: -5 }],
      ['expenses', { ...expenseInput(w, 1000), thirdPartyName: '' }],
      ['attach', { attachment: { url: 'http://evil.test/x.jpg', kind: 'image', name: 'x' } }],
      ['annul', { reason: 'x' }],
      ['reimbursements', { registerId: 'r', expenseIds: [] }],
      ['approve', { source: { kind: 'OTRO' } }],
      ['reject', { note: 'no' }],
    ];
    for (const [group, body] of bodies) {
      const res = await call(group, 'POST', { body, params: P });
      expect(res.status, group).toBe(400);
    }
  });

  it('400 en listados sin registerId o con estado inválido', async () => {
    expect((await call('expenses', 'GET')).status).toBe(400);
    expect((await call('expenses', 'GET', { query: '?registerId=r&status=X' })).status).toBe(400);
    expect((await call('reimbursements', 'GET')).status).toBe(400);
  });
});

describe('flujo por HTTP', () => {
  beforeEach(() => {
    as('all', ['petty_cash.manage', 'petty_cash.approve']);
  });

  it('constituye, registra, legaliza y rechaza al aprobar con el mismo usuario', async () => {
    const fund = await call('fund', 'POST', {
      params: { registerId: w.petty.register },
      body: { targetAmount: FUND, source: { kind: 'GENERAL', registerId: w.ids.general } },
    });
    expect(fund.status).toBe(201);
    expect(JSON.stringify(await fund.json())).not.toContain('"audit"');

    const created = await call('expenses', 'POST', { body: expenseInput(w, 20000) });
    expect(created.status).toBe(201);
    const expense = (await created.json()) as { id: string };

    const noSupport = await call('legalize', 'POST', { params: { expenseId: expense.id } });
    expect(noSupport.status).toBe(409);
    const attached = await call('attach', 'POST', {
      params: { expenseId: expense.id },
      body: { attachment: ATTACHMENT },
    });
    expect(attached.status).toBe(200);
    expect((await call('legalize', 'POST', { params: { expenseId: expense.id } })).status).toBe(
      200
    );

    const rb = await call('reimbursements', 'POST', {
      body: { registerId: w.petty.register, expenseIds: [expense.id] },
    });
    expect(rb.status).toBe(201);
    const reimbursement = (await rb.json()) as { id: string };
    // el mismo usuario solicitó: no puede aprobar
    const selfApprove = await call('approve', 'POST', {
      params: { reimbursementId: reimbursement.id },
      body: { source: { kind: 'GENERAL', registerId: w.ids.general } },
    });
    expect(selfApprove.status).toBe(403);

    const list = await call('reimbursements', 'GET', {
      query: `?registerId=${w.petty.register}&status=PENDIENTE_APROBACION`,
    });
    expect(((await list.json()) as { reimbursements: unknown[] }).reimbursements).toHaveLength(1);

    const status = await call('status', 'GET', { params: { registerId: w.petty.register } });
    expect(await status.json()).toMatchObject({ invariantOk: true, pendingVouchersTotal: 20000 });
  });

  it('409 al superar el efectivo y 404 con un gasto inexistente', async () => {
    await call('fund', 'POST', {
      params: { registerId: w.petty.register },
      body: { targetAmount: 60000, source: { kind: 'BANK', bankAccountId: w.ids.accBank } },
    });
    for (let i = 0; i < 2; i++) await call('expenses', 'POST', { body: expenseInput(w, 30000) });
    const over = await call('expenses', 'POST', { body: expenseInput(w, 1000) });
    expect(over.status).toBe(409);
    const missing = await call('legalize', 'POST', { params: { expenseId: 'nope' } });
    expect(missing.status).toBe(404);
  });
});
