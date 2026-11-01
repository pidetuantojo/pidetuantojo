// Día realista de caja (datos ficticios) para probar reportes: reutiliza el recorrido de cash.e2e.
import type { FakeFirestore } from '../orders/fakeFirestore';
import { metaFor, RID, seedCashWorld, seedOrder, type CashWorld } from '../cash/cashFixture';

export const DAY1 = '2026-03-10';
export const DAY2 = '2026-03-12';
const AT1 = '2026-03-10T15:00:00.000Z';
const AT2 = '2026-03-12T15:00:00.000Z';

export interface ReportsMods {
  setup: typeof import('@/lib/ledger/setup.server');
  accounts: typeof import('@/lib/ledger/accounts.server');
  registers: typeof import('@/lib/cash/registers.server');
  settings: typeof import('@/lib/cash/settings.server');
  shifts: typeof import('@/lib/cash/shifts.server');
  movements: typeof import('@/lib/cash/movements.server');
  closing: typeof import('@/lib/cash/closing.server');
  general: typeof import('@/lib/cash/general.server');
  payments: typeof import('@/lib/cash/order-payments.server');
  reports: typeof import('@/lib/ledger/reports.server');
  cashReports: typeof import('@/lib/cash/reports.server');
}

export async function loadReportsMods(): Promise<ReportsMods> {
  return {
    setup: await import('@/lib/ledger/setup.server'),
    accounts: await import('@/lib/ledger/accounts.server'),
    registers: await import('@/lib/cash/registers.server'),
    settings: await import('@/lib/cash/settings.server'),
    shifts: await import('@/lib/cash/shifts.server'),
    movements: await import('@/lib/cash/movements.server'),
    closing: await import('@/lib/cash/closing.server'),
    general: await import('@/lib/cash/general.server'),
    payments: await import('@/lib/cash/order-payments.server'),
    reports: await import('@/lib/ledger/reports.server'),
    cashReports: await import('@/lib/cash/reports.server'),
  };
}

export interface DayWorld {
  world: CashWorld;
  shiftId: string;
}

/**
 * Día 1: saldo inicial, turno con ventas en efectivo y Nequi, retiro aprobado, cierre exacto y
 * una venta de datáfono en la caja general. Día 2: consignación al banco.
 */
export async function seedRealisticDay(db: FakeFirestore, m: ReportsMods): Promise<DayWorld> {
  const world = await seedCashWorld(db, m);
  const { ids } = world;
  ['o1', 'o2', 'o3'].forEach((id) => seedOrder(db, id));
  const sale = (uid: string, orderId: string, payments: { id: string; amount: number }[]) =>
    m.payments.payOrder(
      RID,
      { orderId, payments: payments.map((p) => ({ paymentMethodId: p.id, amount: p.amount })) },
      metaFor(uid, AT1)
    );

  await m.general.createGeneralMovement(
    RID,
    ids.general,
    {
      type: 'INGRESO_VARIO',
      amount: 500000,
      reason: 'Saldo inicial de la caja general',
      accountOverrideId: ids.accEquity,
    },
    metaFor('acc1', AT1)
  );
  const shift = await m.shifts.openShift(
    RID,
    { registerId: ids.reg1, openingCount: { BILLETE_100000: 1 } },
    metaFor('cashier1', AT1)
  );
  await sale('cashier1', 'o1', [{ id: 'pm-efectivo', amount: 50000 }]);
  await sale('cashier1', 'o2', [
    { id: 'pm-efectivo', amount: 30000 },
    { id: 'pm-nequi', amount: 20000 },
  ]);
  await sale('cashier3', 'o3', [{ id: 'pm-datafono', amount: 50000 }]);
  const withdrawal = await m.movements.createManualMovement(
    RID,
    shift.id,
    {
      type: 'RETIRO_PARCIAL',
      amount: 40000,
      methodType: 'efectivo',
      reason: 'retiro de seguridad',
    },
    metaFor('cashier1', AT1)
  );
  await m.movements.decideWithdrawal(
    RID,
    shift.id,
    withdrawal.id,
    { decision: 'APROBAR' },
    metaFor('sup1', AT1)
  );
  // Esperado en efectivo: 100.000 + 50.000 + 30.000 − 40.000 = 140.000
  await m.closing.submitCount(
    RID,
    shift.id,
    { cashCount: { BILLETE_100000: 1, BILLETE_20000: 2 } },
    metaFor('cashier1', AT1)
  );
  await m.general.depositToBank(
    RID,
    { registerId: ids.general, bankAccountId: ids.accBank, amount: 100000, externalRef: 'CONS-2' },
    metaFor('acc1', AT2)
  );
  return { world, shiftId: shift.id };
}
