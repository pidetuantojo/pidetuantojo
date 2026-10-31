import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

let mod: typeof import('@/lib/shared/sequence.server');
beforeAll(async () => {
  mod = await import('@/lib/shared/sequence.server');
});
beforeEach(() => db.docs.clear());

async function nextReceipt(fail = false) {
  return db.runTransaction(async (tx) => {
    const seq = await mod.reserveSequence(tx as never, 'r1', 'receipt');
    if (fail) throw new Error('falla después de leer');
    tx.create(db.doc(`restaurants/r1/receipts/${seq.value}`), { number: seq.value });
    seq.commit(tx as never);
    return seq.value;
  });
}

describe('sequence', () => {
  it('50 transacciones concurrentes dan exactamente 1..50 sin duplicados ni huecos', async () => {
    const values = await Promise.all(Array.from({ length: 50 }, () => nextReceipt()));
    expect([...values].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(db.get('restaurants/r1/sequences/receipt')).toMatchObject({ current: 50 });
  });

  it('una transacción que falla no consume número', async () => {
    expect(await nextReceipt()).toBe(1);
    await expect(nextReceipt(true)).rejects.toThrow();
    expect(await nextReceipt()).toBe(2);
  });

  it('formatSequence rellena con ceros', () => {
    expect(mod.formatSequence('RC', 1)).toBe('RC-000001');
    expect(mod.formatSequence('CE', 42, 4)).toBe('CE-0042');
    expect(mod.formatSequence('RC', 1234567)).toBe('RC-1234567');
  });
});
