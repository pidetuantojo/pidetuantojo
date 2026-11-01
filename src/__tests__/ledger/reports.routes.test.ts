// @vitest-environment node
// Rutas de reportes: 401/403, permiso exigido, validación de parámetros y camino feliz.
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
interface RouteCase {
  name: string;
  permission: string;
  query: string;
  params: Record<string, string>;
  load: () => Promise<{ GET: Handler }>;
}

const CASES: RouteCase[] = [
  {
    name: 'journal',
    permission: 'ledger.view',
    query: '?from=2026-03-01&to=2026-03-31',
    params: {},
    load: () => import('@/app/api/ledger/journal/route') as never,
  },
  {
    name: 'ledger',
    permission: 'ledger.view',
    query: '?accountId=a1&from=2026-03-01&to=2026-03-31',
    params: {},
    load: () => import('@/app/api/ledger/ledger/route') as never,
  },
  {
    name: 'trial-balance',
    permission: 'ledger.view',
    query: '?from=2026-03-01&to=2026-03-31',
    params: {},
    load: () => import('@/app/api/ledger/trial-balance/route') as never,
  },
  {
    name: 'cash daily',
    permission: 'cash.approve',
    query: '?date=2026-03-10',
    params: {},
    load: () => import('@/app/api/cash/reports/daily/route') as never,
  },
  {
    name: 'cash shift',
    permission: 'cash.approve',
    query: '',
    params: { shiftId: 's1' },
    load: () => import('@/app/api/cash/reports/shifts/[shiftId]/route') as never,
  },
  {
    name: 'cash petty',
    permission: 'petty_cash.manage',
    query: '?registerId=p1&from=2026-03-01&to=2026-03-31',
    params: {},
    load: () => import('@/app/api/cash/reports/petty/route') as never,
  },
];

const caller = {
  uid: 'u1',
  role: 'restaurant_admin',
  restaurantId: 'r1',
  isActive: true,
  permissions: [],
};
const get = (route: { GET: Handler }, query: string, params: Record<string, string>) =>
  route.GET(new Request(`http://localhost/api/x${query}`), { params });

beforeAll(async () => {
  await Promise.all(CASES.map((c) => c.load()));
});
beforeEach(() => {
  db.docs.clear();
  db.set('restaurants/r1', { planFeatures: ['features.cash'] });
  requirePermission.mockReset().mockResolvedValue(caller);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe.each(CASES)('GET $name', (c) => {
  it('401 sin sesión', async () => {
    requirePermission.mockRejectedValue(new AuthError('No autenticado', 401));
    expect((await get(await c.load(), c.query, c.params)).status).toBe(401);
  });

  it('403 sin el permiso', async () => {
    requirePermission.mockRejectedValue(new AuthError('Sin permiso', 403));
    expect((await get(await c.load(), c.query, c.params)).status).toBe(403);
  });

  it('exige exactamente el permiso del reporte', async () => {
    await get(await c.load(), c.query, c.params);
    expect(requirePermission).toHaveBeenCalledWith(expect.anything(), c.permission);
  });

  it('403 si el plan no incluye caja', async () => {
    db.set('restaurants/r1', { planFeatures: [] });
    expect((await get(await c.load(), c.query, c.params)).status).toBe(403);
  });
});

describe('validación y camino feliz', () => {
  it('journal: fechas inválidas → 400; límite mayor a 200 → 400', async () => {
    const route = await CASES[0].load();
    expect((await get(route, '?from=2026-13-01&to=2026-03-31', {})).status).toBe(400);
    expect((await get(route, '?from=2026-03-01&to=2026-03-31&limit=500', {})).status).toBe(400);
    expect((await get(route, '?from=2026-04-01&to=2026-03-01', {})).status).toBe(400);
  });

  it('journal: rango vacío → 200 con lista vacía', async () => {
    const res = await get(await CASES[0].load(), CASES[0].query, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [], nextCursor: null });
  });

  it('turno inexistente → 404 y daily vacío → 200', async () => {
    expect((await get(await CASES[4].load(), '', { shiftId: 'x' })).status).toBe(404);
    const daily = await get(await CASES[3].load(), CASES[3].query, {});
    expect(daily.status).toBe(200);
    expect((await daily.json()).restaurantTotals.count).toBe(0);
  });
});
