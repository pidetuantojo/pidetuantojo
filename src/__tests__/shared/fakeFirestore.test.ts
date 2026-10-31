import { describe, it, expect } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

describe('FakeFirestore transacciones', () => {
  it('tx.create falla si el documento ya existe y no deja escrituras a medias', async () => {
    const db = new FakeFirestore();
    db.set('c/a', { v: 1 });
    await expect(
      db.runTransaction(async (tx) => {
        tx.set(db.doc('c/otro'), { v: 9 });
        tx.create(db.doc('c/a'), { v: 2 });
      })
    ).rejects.toThrow(/ALREADY_EXISTS/);
    expect(db.get('c/a')).toEqual({ v: 1 });
    expect(db.get('c/otro')).toBeUndefined();
  });

  it('tx.create crea documentos nuevos', async () => {
    const db = new FakeFirestore();
    await db.runTransaction(async (tx) => {
      tx.create(db.doc('c/nuevo'), { v: 1 });
    });
    expect(db.get('c/nuevo')).toEqual({ v: 1 });
  });

  it('leer después de escribir lanza como Firestore real', async () => {
    const db = new FakeFirestore();
    await expect(
      db.runTransaction(async (tx) => {
        tx.set(db.doc('c/a'), { v: 1 });
        await tx.get(db.doc('c/b'));
      })
    ).rejects.toThrow(/all reads/);
  });

  it('transacciones concurrentes sobre el mismo documento se serializan', async () => {
    const db = new FakeFirestore();
    db.set('c/counter', { n: 0 });
    const ref = db.doc('c/counter');
    await Promise.all(
      Array.from({ length: 20 }, () =>
        db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          tx.update(ref, { n: (snap.data() as { n: number }).n + 1 });
        })
      )
    );
    expect(db.get('c/counter')).toEqual({ n: 20 });
  });

  it('si la función lanza, no se escribe nada', async () => {
    const db = new FakeFirestore();
    await expect(
      db.runTransaction(async (tx) => {
        tx.set(db.doc('c/a'), { v: 1 });
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(db.get('c/a')).toBeUndefined();
  });
});
