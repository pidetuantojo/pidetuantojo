import { describe, expect, it } from 'vitest';

import {
  assertParentConsistent,
  defaultNature,
  isValidAccountCode,
} from '@/lib/ledger/accounts.helpers';
import {
  buildEntryFromRule,
  buildReversalDraft,
  resolveRule,
  validateEntry,
} from '@/lib/ledger/journal.helpers';
import { LedgerError, type LedgerErrorCode } from '@/lib/ledger/ledger.errors';
import type {
  AccountingRule,
  JournalEntry,
  JournalEntryDraft,
  LedgerAccount,
  ResolutionContext,
} from '@/lib/ledger/ledger.types';
import { SEED_ACCOUNTS } from '@/lib/ledger/seed';
import { buildSeedDocs } from '@/lib/ledger/seed.helpers';

let n = 0;
const { accounts, rules } = buildSeedDocs({
  newId: () => `id${++n}`,
  now: '2026-01-01T00:00:00Z',
  createdBy: 'u1',
});
const byId = new Map(accounts.map((a) => [a.id, a]));
const byCode = (code: string) => accounts.find((a) => a.code === code)!;
// Cuentas de contexto: cajas y banco/medio de pago (ids reales del seed)
const ctx: ResolutionContext = {
  sourceCashBoxAccountId: byCode('110505').id,
  targetCashBoxAccountId: byCode('110510').id,
  paymentMethodAccountId: byCode('1110').id,
  expenseCategoryAccountId: byCode('5195').id,
};

const expectCode = (fn: () => unknown, code: LedgerErrorCode) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(LedgerError);
    expect((e as LedgerError).code).toBe(code);
    return;
  }
  throw new Error(`no lanzó ${code}`);
};

const build = (rule: AccountingRule, amount = 15000) =>
  buildEntryFromRule({
    rule,
    amount,
    context: ctx,
    accounts: byId,
    accountingDate: '2026-03-10',
    description: 'prueba',
    sourceType: 'test',
    sourceId: 's1',
  });

describe('resolveRule', () => {
  it('el medio exacto gana sobre el genérico', () => {
    expect(resolveRule(rules, 'SALE', 'datafono').methodType).toBe('datafono');
    expect(resolveRule(rules, 'SALE', 'nequi').methodType).toBe('nequi');
  });
  it('sin regla exacta usa la genérica (null)', () => {
    const only = rules.filter(
      (r) => r.event === 'SALE' && (r.methodType === null || r.methodType === 'efectivo')
    );
    expect(resolveRule(only, 'SALE', 'breb').methodType).toBeNull();
    expect(resolveRule(only, 'SALE', null).methodType).toBeNull();
  });
  it('ignora reglas inactivas o reemplazadas', () => {
    const old = rules.map((r) => (r.event === 'EXPENSE' ? { ...r, isActive: false } : r));
    expectCode(() => resolveRule(old, 'EXPENSE', null), 'RULE_NOT_FOUND');
    const superseded = rules.map((r) => (r.event === 'EXPENSE' ? { ...r, supersededAt: 'x' } : r));
    expectCode(() => resolveRule(superseded, 'EXPENSE', null), 'RULE_NOT_FOUND');
  });
  it('sin regla para el evento lanza RULE_NOT_FOUND', () => {
    expectCode(() => resolveRule([], 'SALE', 'efectivo'), 'RULE_NOT_FOUND');
  });
});

describe('buildEntryFromRule con cada regla del seed', () => {
  it.each(rules.map((r) => [`${r.event}/${r.methodType}`, r] as const))(
    '%s cuadra',
    (_name, rule) => {
      const draft = build(rule);
      expect(draft.lines).toHaveLength(2);
      expect(draft.lines[0]).toMatchObject({ debit: 15000, credit: 0 });
      expect(draft.lines[1]).toMatchObject({ debit: 0, credit: 15000 });
      expect(draft.ruleId).toBe(rule.id);
      expect(draft.ruleVersion).toBe(1);
    }
  );

  it('venta en efectivo: D caja origen / C 4140; datáfono: D 1380', () => {
    const cash = build(resolveRule(rules, 'SALE', 'efectivo'));
    expect(cash.lines.map((l) => l.accountId)).toEqual([
      ctx.sourceCashBoxAccountId,
      byCode('4140').id,
    ]);
    const card = build(resolveRule(rules, 'SALE', 'datafono'));
    expect(card.lines[0].accountId).toBe(byCode('1380').id);
  });

  it('sin contexto requerido lanza MISSING_CONTEXT', () => {
    expectCode(
      () =>
        buildEntryFromRule({
          ...{ rule: resolveRule(rules, 'SALE', 'efectivo') },
          amount: 1000,
          context: {},
          accounts: byId,
          accountingDate: '2026-03-10',
          description: 'x',
          sourceType: 't',
          sourceId: 's',
        }),
      'MISSING_CONTEXT'
    );
  });

  it('monto cero, negativo o decimal', () => {
    const rule = resolveRule(rules, 'SALE', 'efectivo');
    expectCode(() => build(rule, 0), 'ZERO_LINE');
    expectCode(() => build(rule, -5), 'NEGATIVE_AMOUNT');
    expectCode(() => build(rule, 10.5), 'INVALID_AMOUNT');
  });
});

describe('validateEntry', () => {
  const ok = (): JournalEntryDraft => ({
    accountingDate: '2026-03-10',
    event: 'SALE',
    description: 'x',
    sourceType: 't',
    sourceId: 's',
    lines: [
      { accountId: byCode('110505').id, debit: 100, credit: 0 },
      { accountId: byCode('4140').id, debit: 0, credit: 100 },
    ],
  });
  const withLines = (lines: JournalEntryDraft['lines']) => ({ ...ok(), lines });

  it('acepta un asiento válido y uno de varias líneas', () => {
    expect(() => validateEntry(ok(), byId)).not.toThrow();
    const multi = withLines([
      { accountId: byCode('110505').id, debit: 100, credit: 0 },
      { accountId: byCode('1110').id, debit: 50, credit: 0 },
      { accountId: byCode('4140').id, debit: 0, credit: 120 },
      { accountId: byCode('2408').id, debit: 0, credit: 30 },
    ]);
    expect(() => validateEntry(multi, byId)).not.toThrow();
  });
  it('UNBALANCED', () => {
    expectCode(
      () =>
        validateEntry(withLines([{ ...ok().lines[0] }, { ...ok().lines[1], credit: 90 }]), byId),
      'UNBALANCED'
    );
  });
  it('EMPTY', () => expectCode(() => validateEntry(withLines([]), byId), 'EMPTY'));
  it('ZERO_LINE', () => {
    expectCode(
      () => validateEntry(withLines([{ accountId: byCode('4140').id, debit: 0, credit: 0 }]), byId),
      'ZERO_LINE'
    );
  });
  it('NEGATIVE_AMOUNT', () => {
    expectCode(
      () =>
        validateEntry(withLines([{ accountId: byCode('4140').id, debit: -1, credit: 0 }]), byId),
      'NEGATIVE_AMOUNT'
    );
  });
  it('BOTH_SIDES', () => {
    expectCode(
      () => validateEntry(withLines([{ accountId: byCode('4140').id, debit: 5, credit: 5 }]), byId),
      'BOTH_SIDES'
    );
  });
  it('ACCOUNT_NOT_FOUND', () => {
    expectCode(
      () => validateEntry(withLines([{ accountId: 'nope', debit: 5, credit: 0 }]), byId),
      'ACCOUNT_NOT_FOUND'
    );
  });
  it('ACCOUNT_INACTIVE y allowInactive', () => {
    const inactive = new Map(byId).set(byCode('4140').id, { ...byCode('4140'), isActive: false });
    expectCode(() => validateEntry(ok(), inactive), 'ACCOUNT_INACTIVE');
    expect(() => validateEntry(ok(), inactive, { allowInactive: true })).not.toThrow();
  });
  it('ACCOUNT_NOT_POSTABLE (1105 es de agrupación)', () => {
    expectCode(
      () =>
        validateEntry(
          withLines([
            { accountId: byCode('1105').id, debit: 5, credit: 0 },
            { accountId: byCode('4140').id, debit: 0, credit: 5 },
          ]),
          byId
        ),
      'ACCOUNT_NOT_POSTABLE'
    );
  });
  it('INVALID_DATE', () => {
    expectCode(
      () => validateEntry({ ...ok(), accountingDate: '2026-02-30' }, byId),
      'INVALID_DATE'
    );
    expectCode(() => validateEntry({ ...ok(), accountingDate: 'hoy' }, byId), 'INVALID_DATE');
  });
});

describe('buildReversalDraft', () => {
  const original = (): JournalEntry => ({
    ...build(resolveRule(rules, 'SALE', 'efectivo')),
    id: 'e1',
    number: 'CC-000001',
    sequence: 1,
    totalDebit: 15000,
    totalCredit: 15000,
    audit: { uid: 'u', at: '', accountingDate: '2026-03-10', ip: null, userAgent: null },
    createdAt: '',
  });
  const meta = { accountingDate: '2026-03-11', reason: 'error de digitación' };

  it('intercambia débito y crédito y referencia al original', () => {
    const draft = buildReversalDraft(original(), meta);
    expect(draft.reversesEntryId).toBe('e1');
    expect(draft.lines[0]).toMatchObject({
      accountId: ctx.sourceCashBoxAccountId,
      debit: 0,
      credit: 15000,
    });
    expect(draft.lines[1]).toMatchObject({ accountId: byCode('4140').id, debit: 15000, credit: 0 });
    expect(draft.description).toContain('CC-000001');
    expect(() => validateEntry(draft, byId)).not.toThrow();
  });
  it('ALREADY_REVERSED', () => {
    expectCode(
      () => buildReversalDraft({ ...original(), reversedByEntryId: 'e2' }, meta),
      'ALREADY_REVERSED'
    );
  });
  it('CANNOT_REVERSE_REVERSAL', () => {
    expectCode(
      () => buildReversalDraft({ ...original(), reversesEntryId: 'e0' }, meta),
      'CANNOT_REVERSE_REVERSAL'
    );
  });
});

describe('accounts.helpers', () => {
  it('valida el código (1 a 10 dígitos)', () => {
    ['1', '110505', '1234567890'].forEach((c) => expect(isValidAccountCode(c)).toBe(true));
    ['', '12345678901', '11a', '1.1', ' 11'].forEach((c) =>
      expect(isValidAccountCode(c)).toBe(false)
    );
  });
  it('naturaleza por clase', () => {
    expect(defaultNature('ACTIVO')).toBe('DEBITO');
    expect(defaultNature('GASTO')).toBe('DEBITO');
    expect(defaultNature('COSTO')).toBe('DEBITO');
    expect(defaultNature('PASIVO')).toBe('CREDITO');
    expect(defaultNature('PATRIMONIO')).toBe('CREDITO');
    expect(defaultNature('INGRESO')).toBe('CREDITO');
  });
  it('el padre debe ser prefijo propio y existir', () => {
    const codes = new Set(['1105']);
    expect(() => assertParentConsistent('110505', '1105', codes)).not.toThrow();
    expect(() => assertParentConsistent('110505', undefined, codes)).not.toThrow();
    expectCode(() => assertParentConsistent('210505', '1105', codes), 'PARENT_MISMATCH');
    expectCode(() => assertParentConsistent('1105', '1105', codes), 'PARENT_MISMATCH');
    expectCode(() => assertParentConsistent('110505', '11', codes), 'PARENT_NOT_FOUND');
    expectCode(() => assertParentConsistent('110505', 'x', codes), 'INVALID_ACCOUNT_CODE');
  });
  it('el seed es coherente: padres existen y naturalezas válidas', () => {
    const codes = new Set(SEED_ACCOUNTS.map((a) => a.code));
    SEED_ACCOUNTS.forEach((a) => assertParentConsistent(a.code, a.parentCode, codes));
    expect(accounts.every((a: LedgerAccount) => a.needsAccountantReview)).toBe(true);
  });
});
