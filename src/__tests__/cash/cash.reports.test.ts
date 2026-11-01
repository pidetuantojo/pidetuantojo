// @vitest-environment node
// Reportes de caja: resumen diario, cierre por turno y estado de caja menor.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDailySummary, groupExpenses } from '@/lib/cash/reports.helpers';

import { FakeFirestore } from '../orders/fakeFirestore';
import { collectionDocs, metaFor, RID } from './cashFixture';
import {
  DAY1,
  DAY2,
  loadReportsMods,
  seedRealisticDay,
  type DayWorld,
  type ReportsMods,
} from '../ledger/reportsFixture';
import {
  ATTACHMENT,
  expenseInput,
  FUND,
  generalSource,
  loadPettyMods,
  seedPettyWorld,
  type PettyMods,
} from './petty/pettyFixture';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

let m: ReportsMods;
let pm: PettyMods;
beforeAll(async () => {
  m = await loadReportsMods();
  pm = await loadPettyMods();
});
beforeEach(() => {
  db.docs.clear();
});

const movements = () => collectionDocs(db, 'cashMovements');

describe('buildDailySummary (puro)', () => {
  it('los totales del restaurante excluyen espejos; la caja los muestra aparte', () => {
    const summary = buildDailySummary(
      DAY1,
      [
        { id: 'a', name: 'Caja 1', type: 'REGISTRADORA' },
        { id: 'g', name: 'General', type: 'GENERAL' },
      ],
      [
        { registerId: 'a', direction: 'OUT', amount: 40000, methodType: 'efectivo' },
        {
          registerId: 'g',
          direction: 'IN',
          amount: 40000,
          methodType: 'efectivo',
          mirrorOfMovementId: 'x',
        },
        { registerId: 'a', direction: 'IN', amount: 10000, methodType: 'efectivo' },
      ]
    );
    const general = summary.registers.find((r) => r.registerId === 'g')!;
    expect(general.methods[0]).toMatchObject({ in: 40000, mirrorIn: 40000, count: 1 });
    expect(summary.restaurantTotals).toMatchObject({
      in: 10000,
      out: 40000,
      net: -30000,
      count: 2,
    });
  });

  it('groupExpenses agrupa por categoría y estado', () => {
    const groups = groupExpenses([
      { categoryId: 'c1', categoryName: 'Aseo', status: 'LEGALIZADO', amount: 100 },
      { categoryId: 'c1', categoryName: 'Aseo', status: 'LEGALIZADO', amount: 50 },
      { categoryId: 'c1', categoryName: 'Aseo', status: 'PENDIENTE', amount: 10 },
    ]);
    expect(groups).toEqual([
      expect.objectContaining({ status: 'LEGALIZADO', count: 2, total: 150 }),
      expect.objectContaining({ status: 'PENDIENTE', count: 1, total: 10 }),
    ]);
  });
});

describe('resumen diario y cierre por turno', () => {
  let day: DayWorld;
  beforeEach(async () => {
    day = await seedRealisticDay(db, m);
  });

  it('suma por caja y medio de pago; el total del restaurante no duplica espejos', async () => {
    const summary = await m.cashReports.getDailySummary(RID, DAY1);
    const applied = movements().filter(
      (mv) => mv.accountingDate === DAY1 && mv.status === 'APLICADO'
    );
    const real = applied.filter((mv) => !mv.mirrorOfMovementId);
    const mirrors = applied.filter((mv) => mv.mirrorOfMovementId);
    expect(mirrors.length).toBeGreaterThan(0);

    const sum = (list: typeof applied, dir: string) =>
      list.filter((mv) => mv.direction === dir).reduce((t, mv) => t + (mv.amount as number), 0);
    expect(summary.restaurantTotals.in).toBe(sum(real, 'IN'));
    expect(summary.restaurantTotals.out).toBe(sum(real, 'OUT'));
    expect(summary.restaurantTotals.count).toBe(real.length);

    const registersIn = summary.registers.reduce((t, r) => t + r.totals.in, 0);
    expect(registersIn).toBe(sum(applied, 'IN'));
    expect(registersIn).toBeGreaterThan(summary.restaurantTotals.in);
    const methods = summary.restaurantTotals.methods.map((x) => x.methodType);
    expect(methods).toEqual(expect.arrayContaining(['efectivo', 'nequi', 'datafono']));
    expect(summary.rule).toMatch(/excluyen los espejos/);
  });

  it('otro día solo trae sus movimientos', async () => {
    const summary = await m.cashReports.getDailySummary(RID, DAY2);
    expect(summary.restaurantTotals.count).toBe(1);
    expect(summary.restaurantTotals.out).toBe(100000);
  });

  it('reporte de cierre: turno, conteo, movimientos, cierre y asientos', async () => {
    const report = await m.cashReports.getShiftReport(RID, day.shiftId);
    expect(report.shift.status).toBe('CERRADO');
    expect(report.register).toMatchObject({ id: day.world.ids.reg1, name: 'Caja 1' });
    expect(report.cashierUid).toBe('cashier1');
    expect(report.openingTotal).toBe(100000);
    expect(report.openingCount).toEqual({ BILLETE_100000: 1 });
    expect(report.closing).toMatchObject({ countedCash: 140000, cashDifference: 0 });
    expect(report.closing?.expectedByMethod.efectivo).toBe(140000);
    expect(report.movements.length).toBeGreaterThanOrEqual(4);
    expect(report.movements.every((mv) => !('audit' in mv))).toBe(true);
    expect(report.journalEntryNumbers.length).toBeGreaterThan(0);
    expect(report.journalEntryNumbers.every((n) => /^CC-\d{6}$/.test(n))).toBe(true);
  });

  it('turno inexistente → SHIFT_NOT_FOUND', async () => {
    await expect(m.cashReports.getShiftReport(RID, 'nope')).rejects.toMatchObject({
      code: 'SHIFT_NOT_FOUND',
    });
  });
});

describe('estado de caja menor', () => {
  it('agrupa gastos por categoría/estado y lista reembolsos del rango', async () => {
    const w = await seedPettyWorld(db, pm);
    await pm.fund.setPettyFund(
      RID,
      w.petty.register,
      { targetAmount: FUND, source: generalSource(w) },
      metaFor('boss')
    );
    const create = (amount: number, categoryId: string) =>
      pm.expenses.createExpense(RID, expenseInput(w, amount, { categoryId }), metaFor('petty1'));
    const e1 = await create(35000, w.categories.aseo);
    await create(18000, w.categories.transporte);
    await pm.expenses.addAttachment(RID, e1.id, ATTACHMENT, metaFor('petty1'));
    await pm.expenses.legalizeExpense(RID, e1.id, metaFor('petty1'));
    const rb = await pm.reimbursements.requestReimbursement(
      RID,
      { registerId: w.petty.register, expenseIds: [e1.id] },
      metaFor('petty1')
    );
    await pm.reimbursements.approveReimbursement(
      RID,
      rb.id,
      { source: generalSource(w) },
      metaFor('boss')
    );

    const report = await m.cashReports.getPettyReport(RID, {
      registerId: w.petty.register,
      from: '2026-03-01',
      to: '2026-03-31',
    });
    expect(report.status).toMatchObject({ fundAmount: FUND, invariantOk: true });
    expect(report.status.pendingVouchersTotal).toBe(18000);
    expect(report.expenseCount).toBe(2);
    expect(report.expensesTotal).toBe(53000);
    expect(report.expensesByCategory.map((g) => `${g.categoryName}:${g.status}`)).toEqual([
      'Aseo:REEMBOLSADO',
      'Transporte:PENDIENTE',
    ]);
    expect(report.reimbursements).toHaveLength(1);
    expect(report.reimbursedTotal).toBe(35000);

    const outside = await m.cashReports.getPettyReport(RID, {
      registerId: w.petty.register,
      from: '2026-04-01',
      to: '2026-04-30',
    });
    expect(outside.expenseCount).toBe(0);
    expect(outside.reimbursements).toHaveLength(0);
  });
});
