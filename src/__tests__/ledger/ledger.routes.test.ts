// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

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
  routes.setup = (await import('@/app/api/ledger/setup/route')) as never;
  routes.accounts = (await import('@/app/api/ledger/accounts/route')) as never;
  routes.account = (await import('@/app/api/ledger/accounts/[accountId]/route')) as never;
  routes.rules = (await import('@/app/api/ledger/rules/route')) as never;
  routes.rule = (await import('@/app/api/ledger/rules/[ruleId]/route')) as never;
  routes.deactivate = (await import('@/app/api/ledger/rules/[ruleId]/deactivate/route')) as never;
  routes.reverse = (await import('@/app/api/ledger/entries/[entryId]/reverse/route')) as never;
});

const caller = {
  uid: 'u1',
  role: 'restaurant_admin',
  restaurantId: 'r1',
  isActive: true,
  permissions: [],
};
let keySeq = 0;
const call = (
  handler: keyof (typeof routes)[string],
  group: string,
  opts: {
    method?: string;
    body?: unknown;
    params?: Record<string, string>;
    key?: boolean;
    query?: string;
  } = {}
) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.key !== false && opts.method !== 'GET')
    headers['Idempotency-Key'] = `route-key-${String(++keySeq).padStart(6, '0')}`;
  const req = new Request(`http://localhost/api/ledger/x${opts.query ?? ''}`, {
    method: opts.method ?? 'POST',
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  return routes[group][handler](req, {
    params: opts.params ?? {},
  });
};

beforeEach(() => {
  db.docs.clear();
  db.set('restaurants/r1', { planFeatures: ['features.cash'] });
  requirePermission.mockReset().mockResolvedValue(caller);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const setupLedger = async () => {
  const res = await call('POST', 'setup');
  expect(res.status).toBe(201);
};
const accountByCode = async (code: string) => {
  const res = await call('GET', 'accounts', { method: 'GET' });
  return ((await res.json()).accounts as { id: string; code: string }[]).find(
    (a) => a.code === code
  )!;
};

describe('autenticación, permisos y plan', () => {
  it('401 sin token', async () => {
    requirePermission.mockRejectedValue(new AuthError('No autenticado', 401));
    expect((await call('GET', 'accounts', { method: 'GET' })).status).toBe(401);
    expect((await call('POST', 'setup')).status).toBe(401);
  });

  it('403 sin permiso, pidiendo el permiso correcto', async () => {
    requirePermission.mockRejectedValue(new AuthError('No tienes permiso para esta acción', 403));
    expect((await call('POST', 'accounts', { body: {} })).status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith(expect.anything(), 'ledger.manage');
    await call('GET', 'accounts', { method: 'GET' });
    expect(requirePermission).toHaveBeenLastCalledWith(expect.anything(), 'ledger.view');
  });

  it('gate estricto: sin planFeatures tampoco pasa (el super admin sí)', async () => {
    db.set('restaurants/r1', {});
    expect((await call('GET', 'accounts', { method: 'GET' })).status).toBe(403);
    requirePermission.mockResolvedValue({ ...caller, role: 'super_admin' });
    expect((await call('GET', 'accounts', { method: 'GET' })).status).toBe(200);
  });

  it('403 si el plan no incluye features.cash (todas las rutas)', async () => {
    db.set('restaurants/r1', { planFeatures: ['features.printing'] });
    const p = { params: { accountId: 'a', ruleId: 'r', entryId: 'e' } };
    const responses = await Promise.all([
      call('POST', 'setup'),
      call('GET', 'accounts', { method: 'GET' }),
      call('POST', 'accounts', { body: { code: '5105', name: 'Gastos', class: 'GASTO' } }),
      call('PATCH', 'account', { method: 'PATCH', body: { name: 'xx' }, ...p }),
      call('GET', 'rules', { method: 'GET' }),
      call('PUT', 'rule', { method: 'PUT', body: {}, ...p }),
      call('POST', 'deactivate', p),
      call('POST', 'reverse', { body: { reason: 'motivo valido' }, ...p }),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(403));
    expect((await responses[0].json()).error).toMatch(/plan/i);
  });

  it('el super admin puede indicar ?restaurantId=; los demás usan el suyo', async () => {
    const has = (rid: string) =>
      Array.from(db.docs.keys()).some((k) => k.startsWith(`restaurants/${rid}/ledgerAccounts/`));
    db.set('restaurants/r2', { planFeatures: ['features.cash'] });

    // un empleado del restaurante r1 no puede apuntar a r2
    expect((await call('POST', 'setup', { query: '?restaurantId=r2' })).status).toBe(201);
    expect(has('r1')).toBe(true);
    expect(has('r2')).toBe(false);

    db.docs.clear();
    db.set('restaurants/r2', { planFeatures: ['features.cash'] });
    requirePermission.mockResolvedValue({
      ...caller,
      role: 'super_admin',
      restaurantId: undefined,
    });
    expect((await call('POST', 'setup')).status).toBe(400);
    expect((await call('POST', 'setup', { query: '?restaurantId=r2' })).status).toBe(201);
    expect(has('r2')).toBe(true);
  });
});

describe('validación del cuerpo', () => {
  beforeEach(setupLedger);

  it('400 con cuenta inválida, código extra o sin Idempotency-Key', async () => {
    expect(
      (await call('POST', 'accounts', { body: { code: '11a', name: 'X cuenta', class: 'GASTO' } }))
        .status
    ).toBe(400);
    expect(
      (await call('POST', 'accounts', { body: { code: '5105', name: 'Gastos', class: 'OTRA' } }))
        .status
    ).toBe(400);
    expect(
      (
        await call('POST', 'accounts', {
          body: { code: '5105', name: 'Gastos', class: 'GASTO' },
          key: false,
        })
      ).status
    ).toBe(400);
    const bank = await accountByCode('1110');
    const patch = await call('PATCH', 'account', {
      method: 'PATCH',
      body: { code: '9999' },
      params: { accountId: bank.id },
    });
    expect(patch.status).toBe(400);
  });

  it('400 con regla inválida y con reversión sin motivo suficiente', async () => {
    expect(
      (
        await call('POST', 'rules', {
          body: {
            event: 'NOPE',
            methodType: null,
            debit: { kind: 'sourceCashBox' },
            credit: { kind: 'sourceCashBox' },
          },
        })
      ).status
    ).toBe(400);
    const res = await call('POST', 'reverse', {
      body: { reason: 'abc' },
      params: { entryId: 'e1' },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/motivo/i);
    const tooLong = await call('POST', 'reverse', {
      body: { reason: 'x'.repeat(501) },
      params: { entryId: 'e1' },
    });
    expect(tooLong.status).toBe(400);
  });
});

describe('caminos felices', () => {
  it('setup es idempotente (201 y luego 200)', async () => {
    expect((await call('POST', 'setup')).status).toBe(201);
    const second = await call('POST', 'setup');
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ created: false });
  });

  it('lista cuentas y reglas sembradas', async () => {
    await setupLedger();
    const accounts = (await (await call('GET', 'accounts', { method: 'GET' })).json()).accounts;
    expect(accounts).toHaveLength(11);
    const rules = (await (await call('GET', 'rules', { method: 'GET' })).json()).rules;
    expect(rules.length).toBeGreaterThan(10);
  });

  it('crea y edita una cuenta; 409 si el código existe', async () => {
    await setupLedger();
    const body = { code: '5105', name: 'Gastos de personal', class: 'GASTO' };
    const created = await call('POST', 'accounts', { body });
    expect(created.status).toBe(201);
    const account = await created.json();
    expect(account).toMatchObject({ code: '5105', nature: 'DEBITO' });
    expect((await call('POST', 'accounts', { body })).status).toBe(409);

    const patched = await call('PATCH', 'account', {
      method: 'PATCH',
      body: { name: 'Nómina' },
      params: { accountId: account.id },
    });
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ name: 'Nómina', code: '5105' });
  });

  it('versiona una regla y la desactiva', async () => {
    await setupLedger();
    const rules = (await (await call('GET', 'rules', { method: 'GET' })).json()).rules as {
      id: string;
      event: string;
    }[];
    const expense = rules.find((r) => r.event === 'EXPENSE')!;
    const exp = await accountByCode('5195');
    const put = await call('PUT', 'rule', {
      method: 'PUT',
      body: { debit: { kind: 'fixed', accountId: exp.id }, credit: { kind: 'targetCashBox' } },
      params: { ruleId: expense.id },
    });
    expect(put.status).toBe(200);
    const v2 = await put.json();
    expect(v2.version).toBe(2);
    const off = await call('POST', 'deactivate', { params: { ruleId: v2.id } });
    expect(off.status).toBe(200);
    expect(await off.json()).toMatchObject({ isActive: false });
    expect((await call('POST', 'deactivate', { params: { ruleId: v2.id } })).status).toBe(409);
    expect((await call('POST', 'deactivate', { params: { ruleId: 'nope' } })).status).toBe(404);
  });

  it('reversa un asiento y rechaza la segunda reversión (409) o un id inexistente (404)', async () => {
    await setupLedger();
    const [cash, rev] = [await accountByCode('110505'), await accountByCode('4140')];
    db.set('restaurants/r1/journalEntries/e1', {
      id: 'e1',
      number: 'CC-000001',
      sequence: 1,
      accountingDate: '2026-03-10',
      event: 'SALE',
      description: 'venta',
      sourceType: 'order',
      sourceId: 'o1',
      totalDebit: 9000,
      totalCredit: 9000,
      createdAt: 'x',
      audit: {},
      lines: [
        { accountId: cash.id, debit: 9000, credit: 0 },
        { accountId: rev.id, debit: 0, credit: 9000 },
      ],
    });
    const ok = await call('POST', 'reverse', {
      body: { reason: 'cobro duplicado' },
      params: { entryId: 'e1' },
    });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ reversesEntryId: 'e1', number: 'CC-000001' });
    expect(db.get('restaurants/r1/journalEntries/e1')).toMatchObject({
      reversedByEntryId: expect.any(String),
    });
    expect(
      (
        await call('POST', 'reverse', {
          body: { reason: 'cobro duplicado' },
          params: { entryId: 'e1' },
        })
      ).status
    ).toBe(409);
    expect(
      (
        await call('POST', 'reverse', {
          body: { reason: 'cobro duplicado' },
          params: { entryId: 'zzz' },
        })
      ).status
    ).toBe(404);
  });
});
