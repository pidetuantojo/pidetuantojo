import { describe, expect, it } from 'vitest';

import type { JournalLine, LedgerAccount } from '@/lib/ledger/ledger.types';
import {
  buildTrialBalance,
  buildTrialBalanceRow,
  closingBalance,
  decodeCursor,
  encodeCursor,
  signedAmount,
  sortLedgerLines,
  sumLines,
  withRunningBalance,
} from '@/lib/ledger/reports.helpers';

const line = (id: string, date: string, number: string, debit: number, credit: number) =>
  ({ id, accountingDate: date, entryNumber: number, debit, credit }) as JournalLine;

const account = (nature: LedgerAccount['nature']) =>
  ({ id: 'a', code: '1105', name: 'Caja', nature }) as LedgerAccount;

describe('reports.helpers', () => {
  it('signedAmount respeta la naturaleza', () => {
    expect(signedAmount('DEBITO', 100, 30)).toBe(70);
    expect(signedAmount('CREDITO', 100, 30)).toBe(-70);
  });

  it('saldo corrido parte de la apertura', () => {
    const rows = withRunningBalance(500, 'DEBITO', [
      line('1', '2026-03-10', 'CC-000001', 100, 0),
      line('2', '2026-03-10', 'CC-000002', 0, 250),
    ]);
    expect(rows.map((r) => r.balance)).toEqual([600, 350]);
    expect(closingBalance(500, 'DEBITO', sumLines(rows))).toBe(350);
    expect(closingBalance(500, 'CREDITO', { debit: 100, credit: 400 })).toBe(800);
  });

  it('ordena por fecha y número de asiento', () => {
    const sorted = sortLedgerLines([
      line('b', '2026-03-11', 'CC-000001', 1, 0),
      line('a', '2026-03-10', 'CC-000009', 1, 0),
      line('c', '2026-03-10', 'CC-000002', 1, 0),
    ]);
    expect(sorted.map((l) => l.id)).toEqual(['c', 'a', 'b']);
  });

  it('fila del balance: saldos con signo de la naturaleza y neto D−C', () => {
    const sums = { before: { debit: 0, credit: 300 }, period: { debit: 50, credit: 100 } };
    const credit = buildTrialBalanceRow(account('CREDITO'), sums);
    expect(credit).toMatchObject({
      opening: 300,
      closing: 350,
      openingNet: -300,
      closingNet: -350,
    });
    const debit = buildTrialBalanceRow(account('DEBITO'), sums);
    expect(debit).toMatchObject({ opening: -300, closing: -350 });
  });

  it('balance: totales y bandera balanced', () => {
    const a = buildTrialBalanceRow(account('DEBITO'), {
      before: { debit: 0, credit: 0 },
      period: { debit: 100, credit: 0 },
    });
    const b = buildTrialBalanceRow(
      { ...account('CREDITO'), id: 'b', code: '4140' },
      { before: { debit: 0, credit: 0 }, period: { debit: 0, credit: 100 } }
    );
    const ok = buildTrialBalance({ from: '2026-03-01', to: '2026-03-31' }, [b, a]);
    expect(ok.rows.map((r) => r.code)).toEqual(['1105', '4140']);
    expect(ok).toMatchObject({ totalDebit: 100, totalCredit: 100, balanced: true });
    expect(buildTrialBalance({ from: 'x', to: 'y' }, [a]).balanced).toBe(false);
  });

  it('cursor de ida y vuelta; basura lanza INVALID_CURSOR', () => {
    expect(decodeCursor(encodeCursor('2026-03-10', 7))).toEqual(['2026-03-10', 7]);
    expect(() => decodeCursor('###')).toThrowError(/cursor/);
  });
});
