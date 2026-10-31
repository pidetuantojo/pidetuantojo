import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditContext } from '@/lib/shared/audit.server';

import { FakeFirestore } from '../orders/fakeFirestore';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

type Journal = typeof import('@/lib/ledger/journal.server');
type Accounts = typeof import('@/lib/ledger/accounts.server');
type Rules = typeof import('@/lib/ledger/rules.server');
type Setup = typeof import('@/lib/ledger/setup.server');
type Types = import('@/lib/ledger/ledger.types').LedgerAccount;
type Draft = import('@/lib/ledger/ledger.types').JournalEntryDraft;

let journal: Journal;
let accountsSvc: Accounts;
let rulesSvc: Rules;
let setup: Setup;
beforeAll(async () => {
  journal = await import('@/lib/ledger/journal.server');
  accountsSvc = await import('@/lib/ledger/accounts.server');
  rulesSvc = await import('@/lib/ledger/rules.server');
  setup = await import('@/lib/ledger/setup.server');
});
beforeEach(() => db.docs.clear());

const RID = 'r1';
const audit = (): AuditContext => ({
  uid: 'u1',
  at: '2026-03-10T15:00:00.000Z',
  accountingDate: '2026-03-10',
  ip: null,
  userAgent: null,
});
let keySeq = 0;
const meta = () => ({ audit: audit(), idempotencyKey: `key-${String(++keySeq).padStart(8, '0')}` });

const col = (name: string) =>
  Array.from(db.docs.entries())
    .filter(([p]) => p.startsWith(`restaurants/${RID}/${name}/`))
    .map(([, d]) => d);

async function seeded() {
  await setup.setupLedger(RID, audit());
  const list = await accountsSvc.listAccounts(RID);
  const byCode = (c: string): Types => list.find((a) => a.code === c)!;
  return { list, byCode };
}

const sale = (byCode: (c: string) => Types, amount = 15000): Draft => ({
  accountingDate: '2026-03-10',
  event: 'SALE',
  description: 'venta',
  sourceType: 'order',
  sourceId: 'o1',
  lines: [
    { accountId: byCode('110505').id, debit: amount, credit: 0 },
    { accountId: byCode('4140').id, debit: 0, credit: amount },
  ],
});

const post = (draft: Draft) =>
  db.runTransaction(async (tx) => {
    const prepared = await journal.preparePostEntry(tx as never, RID, draft, audit());
    return prepared.commit(tx as never);
  });

const reverse = (entryId: string, reason = 'error de caja') =>
  db.runTransaction(async (tx) => {
    const prepared = await journal.prepareReverseEntry(
      tx as never,
      RID,
      entryId,
      { reason, accountingDate: '2026-03-11' },
      audit()
    );
    return prepared.commit(tx as never);
  });

describe('setupLedger', () => {
  it('es idempotente: la segunda llamada no crea nada', async () => {
    const first = await setup.setupLedger(RID, audit());
    expect(first).toMatchObject({ created: true, accounts: 11 });
    const snapshot = db.docs.size;
    const second = await setup.setupLedger(RID, audit());
    expect(second.created).toBe(false);
    expect(db.docs.size).toBe(snapshot);
    expect(col('ledgerAccounts')).toHaveLength(11);
    expect(col('accountingRules')).toHaveLength(first.rules);
  });
});

describe('preparePostEntry / commit', () => {
  it('escribe asiento, una línea por renglón y avanza el consecutivo', async () => {
    const { byCode } = await seeded();
    const entry = await post(sale(byCode));
    expect(entry).toMatchObject({
      number: 'CC-000001',
      sequence: 1,
      totalDebit: 15000,
      totalCredit: 15000,
    });
    expect(col('journalEntries')).toHaveLength(1);
    const lines = col('journalLines');
    expect(lines).toHaveLength(2);
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: '110505',
          accountName: 'Caja general',
          debit: 15000,
          entryNumber: 'CC-000001',
        }),
        expect.objectContaining({
          accountCode: '4140',
          credit: 15000,
          accountingDate: '2026-03-10',
          event: 'SALE',
        }),
      ])
    );
    expect((await post(sale(byCode))).number).toBe('CC-000002');
    expect(col('auditLog').length).toBeGreaterThanOrEqual(2);
  });

  it('20 publicaciones concurrentes dan CC-000001..CC-000020 sin huecos ni duplicados', async () => {
    const { byCode } = await seeded();
    const entries = await Promise.all(Array.from({ length: 20 }, () => post(sale(byCode))));
    const numbers = entries.map((e) => e.number).sort();
    expect(numbers).toEqual(
      Array.from({ length: 20 }, (_, i) => `CC-${String(i + 1).padStart(6, '0')}`)
    );
    expect(col('journalEntries')).toHaveLength(20);
    expect(col('journalLines')).toHaveLength(40);
  });

  it('un asiento inválido no consume consecutivo ni escribe nada', async () => {
    const { byCode } = await seeded();
    const bad = {
      ...sale(byCode),
      lines: [
        { accountId: byCode('110505').id, debit: 100, credit: 0 },
        { accountId: byCode('4140').id, debit: 0, credit: 90 },
      ],
    };
    await expect(post(bad)).rejects.toMatchObject({ code: 'UNBALANCED' });
    const inactive = byCode('4140');
    await accountsSvc.updateAccount(RID, byCode('2408').id, { isActive: false }, meta());
    await expect(
      post({
        ...sale(byCode),
        lines: [
          { accountId: byCode('2408').id, debit: 5, credit: 0 },
          { accountId: inactive.id, debit: 0, credit: 5 },
        ],
      })
    ).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
    expect(db.get(`restaurants/${RID}/sequences/journal`)).toBeUndefined();
    expect(col('journalEntries')).toHaveLength(0);
    expect((await post(sale(byCode))).number).toBe('CC-000001');
  });
});

describe('prepareReverseEntry', () => {
  it('crea el contra-asiento y marca el original', async () => {
    const { byCode } = await seeded();
    const original = await post(sale(byCode));
    const reversal = await reverse(original.id);

    expect(reversal).toMatchObject({
      number: 'CC-000002',
      reversesEntryId: original.id,
      totalDebit: 15000,
    });
    expect(reversal.lines[0]).toMatchObject({
      accountId: byCode('110505').id,
      debit: 0,
      credit: 15000,
    });
    const stored = db.get(`restaurants/${RID}/journalEntries/${original.id}`);
    expect(stored).toMatchObject({ reversedByEntryId: reversal.id, number: 'CC-000001' });
    expect(col('journalLines')).toHaveLength(4);
  });

  it('reversar dos veces falla y no consume número', async () => {
    const { byCode } = await seeded();
    const original = await post(sale(byCode));
    await reverse(original.id);
    await expect(reverse(original.id)).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
    expect(db.get(`restaurants/${RID}/sequences/journal`)).toMatchObject({ current: 2 });
  });

  it('reversar una reversión falla', async () => {
    const { byCode } = await seeded();
    const reversal = await reverse((await post(sale(byCode))).id);
    await expect(reverse(reversal.id)).rejects.toMatchObject({ code: 'CANNOT_REVERSE_REVERSAL' });
  });

  it('asiento inexistente', async () => {
    await seeded();
    await expect(reverse('nope')).rejects.toMatchObject({ code: 'ENTRY_NOT_FOUND' });
  });

  it('dos reversiones concurrentes: solo una gana', async () => {
    const { byCode } = await seeded();
    const original = await post(sale(byCode));
    const results = await Promise.allSettled([reverse(original.id), reverse(original.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(col('journalEntries')).toHaveLength(2);
  });

  it('reversar sigue funcionando si una cuenta se desactivó después', async () => {
    const { byCode } = await seeded();
    const original = await post(sale(byCode));
    // 4140 está en reglas activas: se desactiva primero la regla de venta que la usa vía reglas… se fuerza en la BD
    const path = `restaurants/${RID}/ledgerAccounts/${byCode('4140').id}`;
    db.set(path, { ...(db.get(path) as object), isActive: false });
    await expect(reverse(original.id)).resolves.toMatchObject({ reversesEntryId: original.id });
  });
});

describe('accounts service', () => {
  it('crea una cuenta con naturaleza por defecto y rechaza código duplicado o padre inválido', async () => {
    await seeded();
    const acc = await accountsSvc.createAccount(
      RID,
      { code: '5105', name: 'Gastos de personal', class: 'GASTO' },
      meta()
    );
    expect(acc).toMatchObject({ nature: 'DEBITO', isActive: true, allowsMovements: true });
    await expect(
      accountsSvc.createAccount(RID, { code: '5105', name: 'Otra', class: 'GASTO' }, meta())
    ).rejects.toMatchObject({ code: 'DUPLICATE_CODE' });
    await expect(
      accountsSvc.createAccount(
        RID,
        { code: '51050501', name: 'Hija', class: 'GASTO', parentCode: '5110' },
        meta()
      )
    ).rejects.toMatchObject({ code: 'PARENT_MISMATCH' });
    await expect(
      accountsSvc.createAccount(
        RID,
        { code: '510505', name: 'Hija', class: 'GASTO', parentCode: '5105' },
        meta()
      )
    ).resolves.toMatchObject({ parentCode: '5105' });
    await expect(
      accountsSvc.createAccount(
        RID,
        { code: '5107', name: 'Hija', class: 'GASTO', parentCode: '51' },
        meta()
      )
    ).rejects.toMatchObject({ code: 'PARENT_NOT_FOUND' });
  });

  it('el código nunca cambia; clase y naturaleza solo mientras no tenga movimientos', async () => {
    const { byCode } = await seeded();
    const unused = await accountsSvc.createAccount(
      RID,
      { code: '5105', name: 'Gastos', class: 'GASTO' },
      meta()
    );
    const changed = await accountsSvc.updateAccount(
      RID,
      unused.id,
      { class: 'PASIVO', nature: 'CREDITO', name: 'Pasivo X' },
      meta()
    );
    expect(changed).toMatchObject({ class: 'PASIVO', nature: 'CREDITO', code: '5105' });

    await post(sale(byCode));
    await expect(
      accountsSvc.updateAccount(RID, byCode('4140').id, { class: 'GASTO' }, meta())
    ).rejects.toMatchObject({ code: 'ACCOUNT_IMMUTABLE' });
    const renamed = await accountsSvc.updateAccount(
      RID,
      byCode('4140').id,
      { name: 'Ventas restaurante' },
      meta()
    );
    expect(renamed).toMatchObject({ name: 'Ventas restaurante', code: '4140' });
    // las líneas históricas conservan el nombre original
    expect(col('journalLines').map((l) => l.accountName)).toContain('Hoteles y restaurantes');
  });

  it('no se puede desactivar una cuenta usada por una regla activa', async () => {
    const { byCode } = await seeded();
    await expect(
      accountsSvc.updateAccount(RID, byCode('4140').id, { isActive: false }, meta())
    ).rejects.toMatchObject({ code: 'ACCOUNT_USED_BY_RULE' });
    await expect(
      accountsSvc.updateAccount(RID, byCode('4140').id, { allowsMovements: false }, meta())
    ).rejects.toMatchObject({ code: 'ACCOUNT_USED_BY_RULE' });
    await expect(
      accountsSvc.updateAccount(RID, byCode('2408').id, { isActive: false }, meta())
    ).resolves.toMatchObject({ isActive: false });
  });

  it('la misma Idempotency-Key repite el resultado sin duplicar', async () => {
    await seeded();
    const m = meta();
    const a = await accountsSvc.createAccount(
      RID,
      { code: '5105', name: 'Gastos', class: 'GASTO' },
      m
    );
    const b = await accountsSvc.createAccount(
      RID,
      { code: '5105', name: 'Gastos', class: 'GASTO' },
      m
    );
    expect(b.id).toBe(a.id);
    expect((await accountsSvc.listAccounts(RID)).filter((x) => x.code === '5105')).toHaveLength(1);
  });
});

describe('rules service', () => {
  it('actualizar crea la versión 2 y reemplaza la 1', async () => {
    const { byCode } = await seeded();
    const rules = await rulesSvc.listRules(RID);
    const v1 = rules.find((r) => r.event === 'EXPENSE')!;
    const v2 = await rulesSvc.updateRule(
      RID,
      v1.id,
      { debit: { kind: 'fixed', accountId: byCode('5195').id }, credit: { kind: 'targetCashBox' } },
      meta()
    );
    expect(v2).toMatchObject({ version: 2, isActive: true, event: 'EXPENSE', methodType: null });
    const stored = db.get(`restaurants/${RID}/accountingRules/${v1.id}`);
    expect(stored).toMatchObject({ isActive: false, supersededBy: v2.id });
    expect(stored?.supersededAt).toBeTruthy();
    await expect(
      rulesSvc.updateRule(RID, v1.id, { debit: v2.debit, credit: v2.credit }, meta())
    ).rejects.toMatchObject({ code: 'RULE_INACTIVE' });
  });

  it('crear valida cuentas fijas y evita duplicar una regla activa', async () => {
    const { byCode } = await seeded();
    const fixed = (code: string) => ({ kind: 'fixed' as const, accountId: byCode(code).id });
    await expect(
      rulesSvc.createRule(
        RID,
        {
          event: 'EXPENSE',
          methodType: null,
          debit: fixed('5195'),
          credit: { kind: 'sourceCashBox' },
        },
        meta()
      )
    ).rejects.toMatchObject({ code: 'DUPLICATE_RULE' });
    await expect(
      rulesSvc.createRule(
        RID,
        { event: 'SALE', methodType: 'efectivo', debit: fixed('1110'), credit: fixed('4140') },
        meta()
      )
    ).rejects.toMatchObject({ code: 'DUPLICATE_RULE' });
    await expect(
      rulesSvc.createRule(
        RID,
        { event: 'EXPENSE', methodType: 'nequi', debit: fixed('1105'), credit: fixed('4140') },
        meta()
      )
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_POSTABLE' });
    await expect(
      rulesSvc.createRule(
        RID,
        {
          event: 'EXPENSE',
          methodType: 'nequi',
          debit: { kind: 'fixed', accountId: 'nope' },
          credit: fixed('4140'),
        },
        meta()
      )
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    const ok = await rulesSvc.createRule(
      RID,
      {
        event: 'EXPENSE',
        methodType: 'nequi',
        debit: fixed('5195'),
        credit: { kind: 'paymentMethod' },
      },
      meta()
    );
    expect(ok).toMatchObject({ version: 1, isActive: true });
  });

  it('desactivar libera la cuenta y evita doble desactivación', async () => {
    const { byCode } = await seeded();
    const rule = (await rulesSvc.listRules(RID)).find((r) => r.event === 'GATEWAY_SETTLEMENT')!;
    await rulesSvc.deactivateRule(RID, rule.id, meta());
    await expect(rulesSvc.deactivateRule(RID, rule.id, meta())).rejects.toMatchObject({
      code: 'RULE_INACTIVE',
    });
    // 1380 sigue en reglas de venta con datáfono: no se puede desactivar aún
    await expect(
      accountsSvc.updateAccount(RID, byCode('1380').id, { isActive: false }, meta())
    ).rejects.toMatchObject({ code: 'ACCOUNT_USED_BY_RULE' });
  });
});
