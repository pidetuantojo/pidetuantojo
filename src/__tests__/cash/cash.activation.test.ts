// @vitest-environment node
// Activación del módulo de caja: prerrequisitos, idempotencia, auditoría y permisos de la ruta.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeActivationMissing } from '@/lib/cash/activation.helpers';

import { FakeFirestore } from '../orders/fakeFirestore';

import {
  auditFor,
  collectionDocs,
  metaFor,
  RID,
  seedCashWorld,
  type CashWorld,
} from './cashFixture';

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

type Handler = (req: Request) => Promise<Response>;
let route: Record<string, Handler>;
let activation: typeof import('@/lib/cash/activation.server');
let settings: typeof import('@/lib/cash/settings.server');
let world: CashWorld;

beforeAll(async () => {
  route = (await import('@/app/api/cash/activation/route')) as never;
  activation = await import('@/lib/cash/activation.server');
  settings = await import('@/lib/cash/settings.server');
});

beforeEach(async () => {
  db.docs.clear();
  world = await seedCashWorld(db, {
    setup: await import('@/lib/ledger/setup.server'),
    accounts: await import('@/lib/ledger/accounts.server'),
    registers: await import('@/lib/cash/registers.server'),
    settings,
  });
  requirePermission.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const restaurant = () => db.get(`restaurants/${RID}`) as { cashModuleEnabled?: boolean };
const mapDatafono = async () => {
  const current = await settings.getSettings(RID);
  await settings.updateSettings(
    RID,
    {
      denominations: current.denominations,
      paymentMethodAccounts: {
        ...current.paymentMethodAccounts,
        'pm-datafono': world.ids.accGateway,
      },
      defaultGeneralRegisterId: current.defaultGeneralRegisterId,
    },
    metaFor('admin')
  );
};

describe('computeActivationMissing (puro)', () => {
  const ok = {
    hasLedgerAccounts: true,
    generalRegisterIds: ['g1'],
    defaultGeneralRegisterId: 'g1',
    paymentMethods: [
      { id: 'pm-efectivo', type: 'efectivo' as const, isActive: true },
      { id: 'pm-nequi', type: 'nequi' as const, isActive: true },
      { id: 'pm-off', type: 'daviplata' as const, isActive: false },
    ],
    paymentMethodAccounts: { 'pm-nequi': 'acc' },
  };

  it('completo: nada falta (efectivo e inactivos no exigen cuenta)', () => {
    expect(computeActivationMissing(ok)).toEqual([]);
  });

  it('reporta cada requisito faltante', () => {
    expect(computeActivationMissing({ ...ok, hasLedgerAccounts: false })).toHaveLength(1);
    expect(computeActivationMissing({ ...ok, generalRegisterIds: [] })).toHaveLength(2);
    expect(computeActivationMissing({ ...ok, defaultGeneralRegisterId: undefined })).toHaveLength(
      1
    );
    expect(computeActivationMissing({ ...ok, paymentMethodAccounts: {} })).toEqual([
      'Asignar la cuenta contable del medio de pago Nequi',
    ]);
  });
});

describe('activación (servidor)', () => {
  it('falta el datáfono sin cuenta: no activa y lista lo que falta', async () => {
    const status = await activation.getActivation(RID);
    expect(status).toEqual({
      enabled: false,
      missing: ['Asignar la cuenta contable del medio de pago Datáfono'],
    });
    const error = await activation
      .setActivation(RID, { enabled: true }, metaFor('admin'))
      .catch((e: Error & { code?: string; extra?: { missing: string[] } }) => e);
    expect(error).toMatchObject({
      code: 'ACTIVATION_PREREQUISITES',
      extra: { missing: status.missing },
    });
    expect(restaurant().cashModuleEnabled).toBeUndefined();
  });

  it('sin plan de cuentas, sin cajas generales y sin caja por defecto', async () => {
    db.docs.clear();
    db.set(`restaurants/${RID}`, { planFeatures: ['features.cash'], paymentMethods: [] });
    const { missing } = await activation.getActivation(RID);
    expect(missing).toEqual([
      'Configurar el plan de cuentas (libro contable)',
      'Crear al menos una caja general',
      'Elegir la caja general por defecto en los ajustes de caja',
    ]);
  });

  it('activa con todo en orden, es idempotente, audita y se puede apagar', async () => {
    await mapDatafono();
    const meta = metaFor('admin', undefined, 'activation-key-0001');
    const first = await activation.setActivation(RID, { enabled: true }, meta);
    expect(first).toEqual({ enabled: true, missing: [] });
    expect(restaurant().cashModuleEnabled).toBe(true);

    const replay = await activation.setActivation(RID, { enabled: true }, meta);
    expect(replay).toEqual(first);
    // Otra llave con el mismo estado: no escribe ni audita de nuevo
    await activation.setActivation(RID, { enabled: true }, metaFor('admin'));
    const logs = collectionDocs(db, 'auditLog').filter((l) => l.action === 'cash.module.enabled');
    expect(logs).toHaveLength(1);

    const off = await activation.setActivation(RID, { enabled: false }, metaFor('admin'));
    expect(off.enabled).toBe(false);
    expect(restaurant().cashModuleEnabled).toBe(false);
    expect(auditFor('admin').uid).toBe('admin');
  });
});

describe('ruta /api/cash/activation', () => {
  const req = (method: string, body?: unknown, key = 'route-activation-0001') =>
    new Request('http://localhost/api/cash/activation', {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(method === 'POST' ? { 'Idempotency-Key': key } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  const asAdmin = () =>
    requirePermission.mockResolvedValue({
      uid: 'admin',
      role: 'restaurant_admin',
      restaurantId: RID,
      isActive: true,
      permissions: ['cash.registers.manage'],
    });

  it('401 sin sesión y 403 sin permiso', async () => {
    requirePermission.mockRejectedValue(new AuthError('No autenticado', 401));
    expect((await route.GET(req('GET'))).status).toBe(401);
    expect((await route.POST(req('POST', { enabled: true }))).status).toBe(401);
    requirePermission.mockRejectedValue(new AuthError('Sin permiso', 403));
    expect((await route.GET(req('GET'))).status).toBe(403);
    expect((await route.POST(req('POST', { enabled: true }))).status).toBe(403);
  });

  it('GET devuelve el checklist; POST 409 con missing y luego 200', async () => {
    asAdmin();
    const get = await route.GET(req('GET'));
    expect(await get.json()).toMatchObject({ enabled: false, missing: expect.any(Array) });

    const blocked = await route.POST(req('POST', { enabled: true }));
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({
      code: 'ACTIVATION_PREREQUISITES',
      missing: ['Asignar la cuenta contable del medio de pago Datáfono'],
    });

    await mapDatafono();
    const ok = await route.POST(req('POST', { enabled: true }, 'route-activation-0002'));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ enabled: true, missing: [] });
  });

  it('exige Idempotency-Key y rechaza campos extra', async () => {
    asAdmin();
    const noKey = new Request('http://localhost/api/cash/activation', {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    });
    expect((await route.POST(noKey)).status).toBe(400);
    expect(
      (await route.POST(req('POST', { enabled: true, x: 1 }, 'route-activation-0003'))).status
    ).toBe(400);
  });
});
