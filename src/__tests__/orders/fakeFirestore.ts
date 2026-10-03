// Firestore en memoria (Admin SDK) para testear la lógica del servidor sin red.
// Soporta lo que usan createOrder/promotions.server: doc/collection/get, where(==, in), limit, getAll,
// runTransaction (get/set/update) y FieldValue.increment.

type Data = Record<string, unknown>;

export const INC = Symbol('increment');
export const increment = (n: number) => ({ [INC]: n });

let autoId = 0;

export class FakeFirestore {
  readonly docs = new Map<string, Data>();

  collection(name: string) {
    return new ColRef(this, name);
  }

  async getAll(...refs: DocRef[]) {
    return Promise.all(refs.map((r) => r.get()));
  }

  async runTransaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> {
    const tx = new FakeTx();
    const result = await fn(tx);
    tx.writes.forEach((w) => (w.kind === 'set' ? this.set(w.ref.path, w.data) : this.update(w.ref.path, w.data)));
    return result;
  }

  set(path: string, data: Data) {
    this.docs.set(path, structuredClone(data));
  }

  update(path: string, data: Data) {
    const current = this.docs.get(path);
    if (!current) throw new Error(`No existe ${path}`);
    for (const [key, value] of Object.entries(data)) {
      const parts = key.split('.');
      let target = current as Data;
      parts.slice(0, -1).forEach((p) => { target[p] = (target[p] as Data) ?? {}; target = target[p] as Data; });
      const last = parts[parts.length - 1];
      if (value && typeof value === 'object' && INC in value) {
        target[last] = ((target[last] as number) ?? 0) + (value as Record<symbol, number>)[INC];
      } else {
        target[last] = value;
      }
    }
  }

  get(path: string): Data | undefined {
    return this.docs.get(path);
  }
}

export class DocRef {
  constructor(private readonly db: FakeFirestore, readonly path: string) {}
  get id() { return this.path.split('/').pop()!; }
  collection(name: string) { return new ColRef(this.db, `${this.path}/${name}`); }
  async get() {
    const data = this.db.get(this.path);
    return { exists: !!data, id: this.id, ref: this, data: () => (data ? structuredClone(data) : undefined) };
  }
  async set(data: Data) { this.db.set(this.path, data); }
  async delete() { this.db.docs.delete(this.path); }
}

class Query {
  constructor(
    protected readonly db: FakeFirestore,
    readonly path: string,
    private readonly filters: { field: string; op: '==' | 'in'; value: unknown }[] = [],
    private readonly max = Infinity,
  ) {}
  where(field: string, op: '==' | 'in', value: unknown) {
    return new Query(this.db, this.path, [...this.filters, { field, op, value }], this.max);
  }
  limit(n: number) { return new Query(this.db, this.path, this.filters, n); }
  orderBy() { return this; }
  async get() {
    const docs = Array.from(this.db.docs.entries())
      .filter(([p]) => p.startsWith(`${this.path}/`) && !p.slice(this.path.length + 1).includes('/'))
      .filter(([, d]) => this.filters.every((f) => (f.op === '==' ? d[f.field] === f.value : (f.value as unknown[]).includes(d[f.field]))))
      .slice(0, this.max)
      .map(([p, d]) => ({ id: p.split('/').pop()!, ref: new DocRef(this.db, p), data: () => structuredClone(d) }));
    return { empty: docs.length === 0, docs };
  }
}

class ColRef extends Query {
  doc(id?: string) { return new DocRef(this.db, `${this.path}/${id ?? `auto${++autoId}`}`); }
}

class FakeTx {
  readonly writes: { kind: 'set' | 'update'; ref: DocRef; data: Data }[] = [];
  get(ref: DocRef) { return ref.get(); }
  set(ref: DocRef, data: Data) { this.writes.push({ kind: 'set', ref, data }); }
  update(ref: DocRef, data: Data) { this.writes.push({ kind: 'update', ref, data }); }
}
