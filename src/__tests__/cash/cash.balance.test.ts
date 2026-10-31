// @vitest-environment node
// Saldo materializado por caja (`cashRegisterBalances`): cada movimiento aplicado lo actualiza,
// siempre coincide con la suma de movimientos y protege contra gastos concurrentes.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

import { metaFor, RID, seedCashWorld, seedOrder, type CashWorld } from './cashFixture';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

type Mods = {
  shifts: typeof import('@/lib/cash/shifts.server');
  movements: typeof import('@/lib/cash/movements.server');
  closing: typeof import('@/lib/cash/closing.server');
  registers: typeof import('@/lib/cash/registers.server');
  general: typeof import('@/lib/cash/general.server');
  balance: typeof import('@/lib/cash/balance.server');
  payments: typeof import('@/lib/cash/order-payments.server');
  refunds: typeof import('@/lib/cash/refunds.server');
  rb: typeof import('@/lib/cash/register-balance.server');
};
let mods: Mods;
let world: CashWorld;

beforeAll(async () => {
  mods = {
    shifts: await import('@/lib/cash/shifts.server'),
    movements: await import('@/lib/cash/movements.server'),
    closing: await import('@/lib/cash/closing.server'),
    registers: await import('@/lib/cash/registers.server'),
    general: await import('@/lib/cash/general.server'),
    balance: await import('@/lib/cash/balance.server'),
    payments: await import('@/lib/cash/order-payments.server'),
    refunds: await import('@/lib/cash/refunds.server'),
    rb: await import('@/lib/cash/register-balance.server'),
  };
});

beforeEach(async () => {
  db.docs.clear();
  world = await seedCashWorld(db, {
    setup: await import('@/lib/ledger/setup.server'),
    accounts: await import('@/lib/ledger/accounts.server'),
    registers: mods.registers,
    settings: await import('@/lib/cash/settings.server'),
  });
  ['o1', 'o2', 'o3'].forEach((id) => seedOrder(db, id));
});

type Doc = { byMethod: Record<string, number>; movementsCount: number };
const docOf = (registerId: string) =>
  db.get(`restaurants/${RID}/cashRegisterBalances/${registerId}`) as Doc | undefined;
const rejects = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: Error & { code?: string }) => error
  );

/** El documento materializado == suma de movimientos, en todas las cajas. */
async function expectReconciled() {
  const { general, reg1, reg2 } = world.ids;
  for (const registerId of [general, reg1, reg2]) {
    const recomputed = await mods.balance.recomputeRegisterBalance(RID, registerId);
    const stored = docOf(registerId)?.byMethod ?? {};
    expect(stored).toEqual(recomputed);
  }
}

const loadInitial = (amount: number) =>
  mods.general.createGeneralMovement(
    RID,
    world.ids.general,
    {
      type: 'INGRESO_VARIO',
      amount,
      reason: 'Saldo inicial de la caja general',
      accountOverrideId: world.ids.accEquity,
    },
    metaFor('acc1')
  );
const deposit = (amount: number, ref: string) =>
  mods.general.depositToBank(
    RID,
    { registerId: world.ids.general, bankAccountId: world.ids.accBank, amount, externalRef: ref },
    metaFor('acc1')
  );

describe('applyDelta (puro)', () => {
  it('suma entradas, resta salidas y cuenta movimientos', () => {
    const { applyDelta, emptyBalanceDoc } = mods.rb;
    const a = applyDelta(
      emptyBalanceDoc(),
      { movementId: 'm1', methodType: 'efectivo', direction: 'IN', amount: 5000 },
      't1'
    );
    const b = applyDelta(
      a,
      { movementId: 'm2', methodType: 'efectivo', direction: 'OUT', amount: 2000 },
      't2'
    );
    expect(b).toMatchObject({
      byMethod: { efectivo: 3000 },
      movementsCount: 2,
      lastMovementId: 'm2',
      updatedAt: 't2',
    });
  });
});

describe('saldo materializado por tipo de movimiento', () => {
  it('se actualiza con cada movimiento y siempre concilia', async () => {
    const { general, reg1 } = world.ids;

    await loadInitial(500000);
    expect(docOf(general)?.byMethod.efectivo).toBe(500000);
    await expectReconciled();

    // Base de apertura: entra a la caja 1 y sale de la general (espejo)
    const shift = await mods.shifts.openShift(
      RID,
      { registerId: reg1, openingCount: { BILLETE_100000: 1 } },
      metaFor('cashier1')
    );
    expect(docOf(reg1)?.byMethod.efectivo).toBe(100000);
    expect(docOf(general)?.byMethod.efectivo).toBe(400000);
    await expectReconciled();

    // Venta en efectivo (caja del turno) y por Nequi de alguien sin turno (caja general)
    await mods.payments.payOrder(
      RID,
      { orderId: 'o1', payments: [{ paymentMethodId: 'pm-efectivo', amount: 50000 }] },
      metaFor('cashier1')
    );
    await mods.payments.payOrder(
      RID,
      { orderId: 'o2', payments: [{ paymentMethodId: 'pm-nequi', amount: 50000 }] },
      metaFor('waiter1')
    );
    expect(docOf(reg1)?.byMethod.efectivo).toBe(150000);
    expect(docOf(general)?.byMethod.nequi).toBe(50000);
    await expectReconciled();

    // Devolución en efectivo
    await mods.refunds.refundOrder(
      RID,
      {
        orderId: 'o1',
        paymentMethodId: 'pm-efectivo',
        amount: 10000,
        reason: 'cliente inconforme',
      },
      metaFor('cashier1')
    );
    expect(docOf(reg1)?.byMethod.efectivo).toBe(140000);
    await expectReconciled();

    // Reverso de un pago: el REVERSO anula la venta
    await mods.payments.payOrder(
      RID,
      { orderId: 'o3', payments: [{ paymentMethodId: 'pm-efectivo', amount: 50000 }] },
      metaFor('cashier1')
    );
    const paymentId = (db.get(`restaurants/${RID}/orders/o3`) as { payments: { id: string }[] })
      .payments[0].id;
    await mods.payments.reverseOrderPayment(
      RID,
      { orderId: 'o3', paymentId, reason: 'cobro equivocado' },
      metaFor('sup1')
    );
    expect(docOf(reg1)?.byMethod.efectivo).toBe(140000);
    await expectReconciled();

    // Retiro: pendiente NO cuenta; al aprobarse sale de la caja 1 y entra a la general
    const withdrawal = await mods.movements.createManualMovement(
      RID,
      shift.id,
      {
        type: 'RETIRO_PARCIAL',
        amount: 30000,
        methodType: 'efectivo',
        reason: 'retiro por seguridad',
      },
      metaFor('cashier1')
    );
    expect(docOf(reg1)?.byMethod.efectivo).toBe(140000);
    await expectReconciled();
    await mods.movements.decideWithdrawal(
      RID,
      shift.id,
      withdrawal.id,
      { decision: 'APROBAR' },
      metaFor('sup1')
    );
    expect(docOf(reg1)?.byMethod.efectivo).toBe(110000);
    expect(docOf(general)?.byMethod.efectivo).toBe(430000);
    await expectReconciled();

    // Cierre exacto: el traslado de cierre lleva lo contado a la general
    await mods.closing.submitCount(
      RID,
      shift.id,
      { cashCount: { BILLETE_100000: 1, BILLETE_10000: 1 } },
      metaFor('cashier1')
    );
    await expectReconciled();
    expect(docOf(reg1)?.byMethod.efectivo).toBe(0);
    expect(docOf(general)?.byMethod.efectivo).toBe(540000);

    // Consignación sale de la general
    await deposit(200000, 'CONS-1');
    expect(docOf(general)?.byMethod.efectivo).toBe(340000);
    await expectReconciled();
  });

  it('no existe documento hasta el primer movimiento y getRegisterBalance lee el documento', async () => {
    expect(docOf(world.ids.general)).toBeUndefined();
    expect((await mods.balance.getRegisterBalance(RID, world.ids.general)).cash).toBe(0);
    await loadInitial(1000);
    expect(docOf(world.ids.general)).toMatchObject({ movementsCount: 1 });
    expect((await mods.balance.getRegisterBalance(RID, world.ids.general)).cash).toBe(1000);
  });
});

describe('concurrencia', () => {
  it('dos consignaciones simultáneas que superan el saldo: solo una pasa', async () => {
    await loadInitial(100000);
    const results = await Promise.all([
      rejects(deposit(70000, 'CONS-A')),
      rejects(deposit(70000, 'CONS-B')),
    ]);
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(results.filter((r) => r?.code === 'INSUFFICIENT_CASH')).toHaveLength(1);
    expect(docOf(world.ids.general)?.byMethod.efectivo).toBe(30000);
    await expectReconciled();
  });

  it('un egreso y una consignación simultáneos sobre el mismo efectivo: solo uno pasa', async () => {
    await loadInitial(100000);
    const results = await Promise.all([
      rejects(deposit(80000, 'CONS-C')),
      rejects(
        mods.general.createGeneralMovement(
          RID,
          world.ids.general,
          { type: 'EGRESO', amount: 80000, reason: 'pago de proveedor' },
          metaFor('acc1')
        )
      ),
    ]);
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(docOf(world.ids.general)?.byMethod.efectivo).toBe(20000);
    await expectReconciled();
  });
});
