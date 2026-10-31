// @vitest-environment node
// Recorrido completo de la fase 2b: saldo inicial -> turnos -> cobros -> devolución -> retiro ->
// cierre a ciegas -> consignación -> liquidación del datáfono. Todo con datos ficticios.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

import {
  collectionDocs,
  metaFor,
  RID,
  seedCashWorld,
  seedOrder,
  type CashWorld,
} from './cashFixture';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

type Mods = {
  shifts: typeof import('@/lib/cash/shifts.server');
  movements: typeof import('@/lib/cash/movements.server');
  closing: typeof import('@/lib/cash/closing.server');
  registers: typeof import('@/lib/cash/registers.server');
  general: typeof import('@/lib/cash/general.server');
  settlements: typeof import('@/lib/cash/settlements.server');
  balance: typeof import('@/lib/cash/balance.server');
  payments: typeof import('@/lib/cash/order-payments.server');
  refunds: typeof import('@/lib/cash/refunds.server');
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
    settlements: await import('@/lib/cash/settlements.server'),
    balance: await import('@/lib/cash/balance.server'),
    payments: await import('@/lib/cash/order-payments.server'),
    refunds: await import('@/lib/cash/refunds.server'),
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
  ['o0', 'o1', 'o2', 'o3'].forEach((id) => seedOrder(db, id));
});

const lines = () => collectionDocs(db, 'journalLines');
const entries = () => collectionDocs(db, 'journalEntries');
const movements = () => collectionDocs(db, 'cashMovements');
const net = (accountId: string) =>
  lines()
    .filter((l) => l.accountId === accountId)
    .reduce((t, l) => t + (l.debit as number) - (l.credit as number), 0);
const sale = (uid: string, orderId: string, payments: { id: string; amount: number }[]) =>
  mods.payments.payOrder(
    RID,
    { orderId, payments: payments.map((p) => ({ paymentMethodId: p.id, amount: p.amount })) },
    metaFor(uid)
  );

describe('integración 2b', () => {
  it('flujo completo: asientos cuadrados, consecutivos sin huecos y saldos conciliados', async () => {
    const { ids } = world;

    // 1. Saldo inicial de la caja general con contrapartida de patrimonio
    await mods.general.createGeneralMovement(
      RID,
      ids.general,
      {
        type: 'INGRESO_VARIO',
        amount: 500000,
        reason: 'Saldo inicial de la caja general',
        accountOverrideId: ids.accEquity,
      },
      metaFor('acc1')
    );

    // 2. Turno previo en la caja 2: base 50.000, vende o0 en efectivo y cierra exacto
    const previous = await mods.shifts.openShift(
      RID,
      { registerId: ids.reg2, openingCount: { BILLETE_50000: 1 } },
      metaFor('cashier2')
    );
    await sale('cashier2', 'o0', [{ id: 'pm-efectivo', amount: 50000 }]);
    const previousClose = await mods.closing.submitCount(
      RID,
      previous.id,
      { cashCount: { BILLETE_100000: 1 } },
      metaFor('cashier2')
    );
    expect(previousClose.status).toBe('CERRADO');

    // 3. Turno principal: base 100.000, venta en efectivo y venta mixta
    const shift = await mods.shifts.openShift(
      RID,
      { registerId: ids.reg1, openingCount: { BILLETE_100000: 1 } },
      metaFor('cashier1')
    );
    await sale('cashier1', 'o1', [{ id: 'pm-efectivo', amount: 50000 }]);
    await sale('cashier1', 'o2', [
      { id: 'pm-efectivo', amount: 30000 },
      { id: 'pm-nequi', amount: 20000 },
    ]);

    // 4. Venta con datáfono de alguien SIN turno: va a la caja general, sin turno
    await sale('cashier3', 'o3', [{ id: 'pm-datafono', amount: 50000 }]);
    const o3Movement = movements().find((m) => m.orderId === 'o3')!;
    expect(o3Movement).toMatchObject({ registerId: ids.general, shiftId: null });

    // 5. Devolución de una venta del turno anterior: sale del turno actual
    await mods.refunds.refundOrder(
      RID,
      { orderId: 'o0', paymentMethodId: 'pm-efectivo', amount: 20000, reason: 'producto frío' },
      metaFor('cashier1')
    );
    expect(movements().find((m) => m.type === 'DEVOLUCION')!.shiftId).toBe(shift.id);

    // 6. Retiro parcial aprobado por un supervisor
    const withdrawal = await mods.movements.createManualMovement(
      RID,
      shift.id,
      {
        type: 'RETIRO_PARCIAL',
        amount: 40000,
        methodType: 'efectivo',
        reason: 'retiro de seguridad',
      },
      metaFor('cashier1')
    );
    await mods.movements.decideWithdrawal(
      RID,
      shift.id,
      withdrawal.id,
      { decision: 'APROBAR' },
      metaFor('sup1')
    );

    // 7. Cierre a ciegas: esperado 120.000, contado 119.500 -> faltante 500 dentro del umbral
    const ack = await mods.closing.submitCount(
      RID,
      shift.id,
      {
        cashCount: {
          BILLETE_100000: 1,
          BILLETE_10000: 1,
          BILLETE_5000: 1,
          BILLETE_2000: 2,
          MONEDA_500: 1,
        },
      },
      metaFor('cashier1')
    );
    expect(ack).toEqual({ shiftId: shift.id, status: 'CERRADO' });

    // 8. Consignación de la caja general al banco y liquidación del datáfono
    await mods.general.depositToBank(
      RID,
      {
        registerId: ids.general,
        bankAccountId: ids.accBank,
        amount: 300000,
        externalRef: 'CONS-1',
      },
      metaFor('acc1')
    );
    await mods.settlements.registerSettlement(
      RID,
      {
        paymentMethodId: 'pm-datafono',
        bankAccountId: ids.accBank,
        amount: 50000,
        externalRef: 'LIQ-1',
      },
      metaFor('acc1')
    );

    // Todos los asientos cuadran
    entries().forEach((e) => expect(e.totalDebit).toBe(e.totalCredit));
    const debits = lines().reduce((t, l) => t + (l.debit as number), 0);
    const credits = lines().reduce((t, l) => t + (l.credit as number), 0);
    expect(debits).toBe(credits);

    // Consecutivos de asientos sin huecos
    const numbers = entries()
      .map((e) => e.number as string)
      .sort();
    expect(numbers).toEqual(
      Array.from({ length: numbers.length }, (_, i) => `CC-${String(i + 1).padStart(6, '0')}`)
    );
    expect(db.get(`restaurants/${RID}/sequences/journal`)).toMatchObject({
      current: numbers.length,
    });

    // Saldo de la general = inicial + base (ida y vuelta) + retiro + traslados de cierre − consignación
    const expectedGeneral = 500000 - 50000 + 100000 - 100000 + 40000 + 119500 - 300000;
    const balance = await mods.balance.getRegisterBalance(RID, ids.general);
    expect(balance.cash).toBe(expectedGeneral);
    expect(expectedGeneral).toBe(309500);

    // El saldo materializado coincide con la suma de movimientos en TODAS las cajas
    for (const registerId of [ids.general, ids.reg1, ids.reg2]) {
      const doc = db.get(`restaurants/${RID}/cashRegisterBalances/${registerId}`) as {
        byMethod: Record<string, number>;
      };
      const recomputed = await mods.balance.recomputeRegisterBalance(RID, registerId);
      expect(doc.byMethod).toEqual(recomputed);
    }

    // Σ líneas contables por cuenta de caja = saldo de cada caja
    expect(net(ids.accGeneral)).toBe(balance.cash);
    expect(net(ids.accReg1)).toBe(0);
    const reg2Account = (await mods.registers.listRegisters(RID)).find(
      (r) => r.id === ids.reg2
    )!.ledgerAccountId;
    expect(net(reg2Account)).toBe(0);

    // Resto del libro: patrimonio, banco, por cobrar del datáfono (vendido 50.000, liquidado 50.000)
    expect(net(ids.accEquity)).toBe(-500000);
    expect(net(ids.accBank)).toBe(20000 + 300000 + 50000);
    expect(net(ids.accGateway)).toBe(0);
    // Ventas 200.000 (o0..o3); la devolución va a 4175, no a 4140
    expect(net(ids.accSales)).toBe(-200000);
    // Faltante de 500 contra cuentas por cobrar a trabajadores (regla por defecto)
    expect(net(ids.accReceivable)).toBe(500);

    // Consecutivos de comprobantes de movimientos reales (los espejos comparten número)
    const real = movements().filter((m) => !m.mirrorOfMovementId);
    const receipts = (prefix: string) =>
      real
        .map((m) => m.receiptNumber as string)
        .filter((n) => n.startsWith(`${prefix}-`))
        .sort();
    ['RC', 'CE', 'TR'].forEach((prefix) => {
      const list = receipts(prefix);
      expect(list).toEqual(
        Array.from({ length: list.length }, (_, i) => `${prefix}-${String(i + 1).padStart(6, '0')}`)
      );
    });
  });
});
