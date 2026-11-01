// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';
import { collectionDocs, RID } from '../cash/cashFixture';

import {
  DAY1,
  DAY2,
  loadReportsMods,
  seedRealisticDay,
  type DayWorld,
  type ReportsMods,
} from './reportsFixture';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

let m: ReportsMods;
let day: DayWorld;
beforeAll(async () => {
  m = await loadReportsMods();
});
beforeEach(async () => {
  db.docs.clear();
  day = await seedRealisticDay(db, m);
});

const lines = () => collectionDocs(db, 'journalLines');
const rawNet = (accountId: string, upTo?: string, before?: string) =>
  lines()
    .filter(
      (l) =>
        l.accountId === accountId &&
        (!upTo || (l.accountingDate as string) <= upTo) &&
        (!before || (l.accountingDate as string) < before)
    )
    .reduce((t, l) => t + (l.debit as number) - (l.credit as number), 0);

describe('libro diario', () => {
  it('pagina con cursor sin repetir ni saltar asientos y en orden', async () => {
    const all = collectionDocs(db, 'journalEntries');
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await m.reports.getJournal(RID, { from: DAY1, to: DAY2, cursor, limit: 3 });
      expect(page.entries.length).toBeLessThanOrEqual(3);
      page.entries.forEach((e) => {
        expect(e.lines.length).toBeGreaterThan(0);
        seen.push(e.number);
      });
      cursor = page.nextCursor ?? undefined;
      pages += 1;
    } while (cursor && pages < 50);
    expect(seen).toHaveLength(all.length);
    expect(new Set(seen).size).toBe(all.length);
    expect(seen).toEqual([...seen].sort());
  });

  it('filtra por rango de fechas contables', async () => {
    const day2 = await m.reports.getJournal(RID, { from: DAY2, to: DAY2, limit: 50 });
    expect(day2.entries).toHaveLength(1);
    expect(day2.entries[0].accountingDate).toBe(DAY2);
    expect(day2.nextCursor).toBeNull();
  });

  it('rechaza un cursor inválido', async () => {
    await expect(
      m.reports.getJournal(RID, { from: DAY1, to: DAY2, cursor: 'xx', limit: 5 })
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });
});

describe('libro mayor', () => {
  it('cuenta de naturaleza débito: apertura, saldo corrido y cierre', async () => {
    const { accGeneral } = day.world.ids;
    const report = await m.reports.getLedger(RID, { accountId: accGeneral, from: DAY2, to: DAY2 });
    expect(report.account.nature).toBe('DEBITO');
    expect(report.openingBalance).toBe(rawNet(accGeneral, undefined, DAY2));
    expect(report.lines).toHaveLength(1);
    expect(report.totalCredit).toBe(100000);
    expect(report.lines[0].balance).toBe(report.openingBalance - 100000);
    expect(report.closingBalance).toBe(rawNet(accGeneral));
    expect(report.truncated).toBe(false);
  });

  it('cuenta de naturaleza crédito: el signo se invierte', async () => {
    const { accSales } = day.world.ids;
    const full = await m.reports.getLedger(RID, { accountId: accSales, from: DAY1, to: DAY2 });
    expect(full.account.nature).toBe('CREDITO');
    expect(full.openingBalance).toBe(0);
    expect(full.totalCredit).toBe(150000);
    expect(full.closingBalance).toBe(150000);
    const later = await m.reports.getLedger(RID, { accountId: accSales, from: DAY2, to: DAY2 });
    expect(later.openingBalance).toBe(150000);
    expect(later.lines).toHaveLength(0);
    expect(later.closingBalance).toBe(150000);
    // saldo corrido = apertura + movimientos acumulados
    let running = 0;
    full.lines.forEach((l) => {
      running += l.credit - l.debit;
      expect(l.balance).toBe(running);
    });
  });

  it('cuenta inexistente → ACCOUNT_NOT_FOUND', async () => {
    await expect(
      m.reports.getLedger(RID, { accountId: 'nope', from: DAY1, to: DAY2 })
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
  });
});

describe('balance de comprobación', () => {
  it('Σ débitos = Σ créditos y saldos netos suman cero tras el día realista', async () => {
    const tb = await m.reports.getTrialBalance(RID, { from: DAY1, to: DAY2 });
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
    expect(tb.totalOpeningNet).toBe(0);
    expect(tb.totalClosingNet).toBe(0);
    const rawDebits = lines().reduce((t, l) => t + (l.debit as number), 0);
    expect(tb.totalDebit).toBe(rawDebits);
    tb.rows.forEach((r) =>
      expect(r.closing).toBe(
        r.opening + (r.nature === 'DEBITO' ? r.debit - r.credit : r.credit - r.debit)
      )
    );
  });

  it('un rango posterior traslada los saldos como apertura y sigue cuadrando', async () => {
    const tb = await m.reports.getTrialBalance(RID, { from: DAY2, to: DAY2 });
    expect(tb.balanced).toBe(true);
    expect(tb.totalOpeningNet).toBe(0);
    const sales = tb.rows.find((r) => r.accountId === day.world.ids.accSales)!;
    expect(sales.opening).toBe(150000);
    expect(sales.closing).toBe(150000);
    const bank = tb.rows.find((r) => r.accountId === day.world.ids.accBank)!;
    expect(bank.debit).toBe(100000);
  });
});
