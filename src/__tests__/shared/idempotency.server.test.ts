import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

let mod: typeof import('@/lib/shared/idempotency.server');
let AuthError: typeof import('@/lib/auth/serverAuth').AuthError;
beforeAll(async () => {
  mod = await import('@/lib/shared/idempotency.server');
  ({ AuthError } = await import('@/lib/auth/serverAuth'));
});
beforeEach(() => db.docs.clear());

const base = { restaurantId: 'r1', scope: 'cash:open-shift', key: 'key-12345678', uid: 'u1' };

async function run(payload: unknown, overrides: Partial<typeof base> = {}, counter = { n: 0 }) {
  return db.runTransaction(async (tx) => {
    const check = await mod.checkIdempotency<{ id: string }>(tx as never, {
      ...base,
      ...overrides,
      payload,
    });
    if (check.status === 'replay') return { replayed: true, result: check.result };
    counter.n++;
    const result = { id: `doc-${counter.n}` };
    tx.set(db.doc(`restaurants/r1/shifts/${result.id}`), { payload });
    check.save(tx as never, result);
    return { replayed: false, result };
  });
}

describe('checkIdempotency', () => {
  it('la primera vez es nueva y guarda el resultado', async () => {
    const out = await run({ amount: 1000 });
    expect(out).toEqual({ replayed: false, result: { id: 'doc-1' } });
    const path = mod.idempotencyDocPath('r1', base.scope, base.key);
    expect(db.get(path)).toMatchObject({ scope: base.scope, uid: 'u1', result: { id: 'doc-1' } });
  });

  it('repetir la misma llave y payload devuelve el resultado guardado sin escribir', async () => {
    const counter = { n: 0 };
    await run({ amount: 1000, b: 1 }, {}, counter);
    const docsBefore = db.docs.size;
    const again = await run({ b: 1, amount: 1000 }, {}, counter); // otro orden de claves
    expect(again).toEqual({ replayed: true, result: { id: 'doc-1' } });
    expect(db.docs.size).toBe(docsBefore);
    expect(counter.n).toBe(1);
  });

  it('misma llave con otro payload da 409', async () => {
    await run({ amount: 1000 });
    const error = await run({ amount: 2000 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect((error as import('@/lib/auth/serverAuth').AuthError).status).toBe(409);
  });

  it('otro scope con la misma llave nunca se trata como replay', async () => {
    await run({ amount: 1000 });
    const other = await run({ amount: 1000 }, { scope: 'cash:close-shift' });
    expect(other.replayed).toBe(false);
  });

  it('un documento guardado con otro scope bajo el mismo path da 409', async () => {
    const path = mod.idempotencyDocPath('r1', base.scope, base.key);
    db.set(path, { scope: 'otro', uid: 'u1', requestHash: 'x', result: {}, createdAt: '' });
    const error = await run({ amount: 1 }).catch((e: unknown) => e);
    expect((error as import('@/lib/auth/serverAuth').AuthError).status).toBe(409);
  });
});

describe('readIdempotencyKey', () => {
  const req = (key?: string) =>
    new Request('http://localhost/x', { headers: key ? { 'Idempotency-Key': key } : {} });

  it('acepta una llave válida', () => {
    expect(mod.readIdempotencyKey(req('abc_DEF-1234'))).toBe('abc_DEF-1234');
  });

  it('falta o es inválida: AuthError 400', () => {
    for (const bad of [undefined, 'corta', 'con espacios aqui', 'x'.repeat(129), 'llave!!!12345']) {
      let caught: unknown;
      try {
        mod.readIdempotencyKey(req(bad));
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AuthError);
      expect((caught as import('@/lib/auth/serverAuth').AuthError).status).toBe(400);
    }
  });
});
