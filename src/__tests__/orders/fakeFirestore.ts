// Firestore en memoria (Admin SDK) para testear la lógica del servidor sin red.
// Soporta: doc/collection/get, where(==, in), limit, getAll, FieldValue.increment y runTransaction con
// get/set/create/update/delete. Las transacciones imitan a Firestore: todas las lecturas antes de las
// escrituras, y concurrencia optimista (versión por documento al confirmar; si cambió, reintenta).

type Data = Record<string, unknown>;

export const INC = Symbol('increment');
export const increment = (n: number) => ({ [INC]: n });

// El Admin SDK real usa bloqueos pesimistas (sin inanición); aquí un margen amplio para N transacciones en paralelo
const MAX_TX_ATTEMPTS = 200;

let autoId = 0;

type TxWrite =
  | { kind: 'set' | 'create' | 'update'; ref: DocRef; data: Data; merge?: boolean }
  | { kind: 'delete'; ref: DocRef };

class ConflictError extends Error {}

export class FakeFirestore {
  readonly docs = new Map<string, Data>();
  // Versión por documento: sube con cada escritura (base de la concurrencia optimista)
  readonly versions = new Map<string, number>();

  collection(name: string) {
    return new ColRef(this, name);
  }

  doc(path: string) {
    return new DocRef(this, path);
  }

  async getAll(...refs: DocRef[]) {
    return Promise.all(refs.map((r) => r.get()));
  }

  versionOf(path: string): number {
    return this.versions.get(path) ?? 0;
  }

  async runTransaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TX_ATTEMPTS; attempt++) {
      const tx = new FakeTx(this);
      const result = await fn(tx);
      try {
        this.commit(tx);
        return result;
      } catch (error) {
        if (!(error instanceof ConflictError) || attempt === MAX_TX_ATTEMPTS) throw error;
      }
    }
    throw new Error('Transacción: demasiados reintentos');
  }

  // Síncrono = atómico (JS es single-thread). Si algo falla, no queda nada a medias.
  private commit(tx: FakeTx) {
    for (const [path, version] of Array.from(tx.reads)) {
      if (this.versionOf(path) !== version) throw new ConflictError(`Conflicto en ${path}`);
    }
    const snapshot = new Map(this.docs);
    const versions = new Map(this.versions);
    try {
      tx.writes.forEach((w) => {
        if (w.kind === 'delete') return this.delete(w.ref.path);
        if (w.kind === 'create') {
          if (this.docs.has(w.ref.path)) throw new Error(`ALREADY_EXISTS: ${w.ref.path}`);
          return this.set(w.ref.path, w.data);
        }
        if (w.kind === 'set') {
          return w.merge && this.docs.has(w.ref.path) ? this.update(w.ref.path, w.data) : this.set(w.ref.path, w.data);
        }
        return this.update(w.ref.path, w.data);
      });
    } catch (error) {
      this.docs.clear();
      snapshot.forEach((v, k) => this.docs.set(k, v));
      this.versions.clear();
      versions.forEach((v, k) => this.versions.set(k, v));
      throw error;
    }
  }

  private bump(path: string) {
    this.versions.set(path, this.versionOf(path) + 1);
  }

  set(path: string, data: Data) {
    this.docs.set(path, structuredClone(data));
    this.bump(path);
  }

  delete(path: string) {
    this.docs.delete(path);
    this.bump(path);
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
    this.bump(path);
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
  async delete() { this.db.delete(this.path); }
}

export class Query {
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

export class FakeTx {
  readonly writes: TxWrite[] = [];
  // path → versión vista al leer
  readonly reads = new Map<string, number>();

  constructor(private readonly db: FakeFirestore) {}

  private assertNoWrites() {
    if (this.writes.length > 0) {
      throw new Error('Firestore transactions require all reads to be executed before all writes.');
    }
  }

  get(target: DocRef): ReturnType<DocRef['get']>;
  get(target: Query): ReturnType<Query['get']>;
  async get(target: DocRef | Query) {
    this.assertNoWrites();
    if (target instanceof DocRef) {
      this.reads.set(target.path, this.db.versionOf(target.path));
      return target.get();
    }
    const snap = await target.get();
    snap.docs.forEach((d) => this.reads.set(d.ref.path, this.db.versionOf(d.ref.path)));
    return snap;
  }

  set(ref: DocRef, data: Data, options?: { merge?: boolean }) { this.writes.push({ kind: 'set', ref, data, merge: options?.merge }); return this; }
  create(ref: DocRef, data: Data) { this.writes.push({ kind: 'create', ref, data }); return this; }
  update(ref: DocRef, data: Data) { this.writes.push({ kind: 'update', ref, data }); return this; }
  delete(ref: DocRef) { this.writes.push({ kind: 'delete', ref }); return this; }
}
