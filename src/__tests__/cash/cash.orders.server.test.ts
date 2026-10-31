// @vitest-environment node
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
  closing: typeof import('@/lib/cash/closing.server');
  payments: typeof import('@/lib/cash/order-payments.server');
  refunds: typeof import('@/lib/cash/refunds.server');
};
let mods: Mods;
let world: CashWorld;

beforeAll(async () => {
  mods = {
    shifts: await import('@/lib/cash/shifts.server'),
    closing: await import('@/lib/cash/closing.server'),
    payments: await import('@/lib/cash/order-payments.server'),
    refunds: await import('@/lib/cash/refunds.server'),
  };
});

beforeEach(async () => {
  db.docs.clear();
  world = await seedCashWorld(db, {
    setup: await import('@/lib/ledger/setup.server'),
    accounts: await import('@/lib/ledger/accounts.server'),
    registers: await import('@/lib/cash/registers.server'),
    settings: await import('@/lib/cash/settings.server'),
  });
  seedOrder(db, 'o1');
});

const doc = (path: string) => db.get(path) as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
const orderDoc = (id = 'o1') => doc(`restaurants/${RID}/orders/${id}`)!;
const movDocs = () => collectionDocs(db, 'cashMovements').filter((m) => !m.mirrorOfMovementId);
const entries = () => collectionDocs(db, 'journalEntries');
const lines = () => collectionDocs(db, 'journalLines');
const rejects = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: Error & { code?: string; status?: number }) => error
  );

const open = (uid = 'cashier1', count: Record<string, number> = { BILLETE_100000: 1 }) =>
  mods.shifts.openShift(RID, { registerId: world.ids.reg1, openingCount: count }, metaFor(uid));
const pay = (
  uid: string,
  payments: { paymentMethodId: string; amount: number; received?: number }[],
  orderId = 'o1',
  key?: string
) => mods.payments.payOrder(RID, { orderId, payments }, metaFor(uid, undefined, key));
const refund = (uid: string, amount: number, method = 'pm-efectivo', orderId = 'o1') =>
  mods.refunds.refundOrder(
    RID,
    { orderId, paymentMethodId: method, amount, reason: 'cliente inconforme' },
    metaFor(uid)
  );
const net = (accountId: string) =>
  lines()
    .filter((l) => l.accountId === accountId)
    .reduce((t, l) => t + (l.debit as number) - (l.credit as number), 0);

describe('cobro de pedidos', () => {
  it('efectivo sin turno abierto -> 409 y nada se escribe', async () => {
    const error = await rejects(
      pay('cashier1', [{ paymentMethodId: 'pm-efectivo', amount: 50000 }])
    );
    expect(error).toMatchObject({ code: 'SHIFT_REQUIRED', status: 409 });
    expect(movDocs()).toHaveLength(0);
    expect(orderDoc().payments).toBeUndefined();
  });

  it('electrónico sin turno: caja general, sin turno, asiento D banco C 4140', async () => {
    const result = await pay('cashier1', [{ paymentMethodId: 'pm-nequi', amount: 50000 }]);
    expect(result.isPaid).toBe(true);
    const [movement] = movDocs();
    expect(movement).toMatchObject({
      type: 'VENTA',
      registerId: world.ids.general,
      shiftId: null,
      methodType: 'nequi',
      orderId: 'o1',
    });
    expect(net(world.ids.accBank)).toBe(50000);
    expect(net(world.ids.accSales)).toBe(-50000);
    expect(orderDoc().payments[0]).toMatchObject({
      movementId: movement.id,
      paidBy: 'cashier1',
      methodType: 'nequi',
    });
  });

  it('datáfono va a 1380 por cobrar', async () => {
    await pay('cashier1', [{ paymentMethodId: 'pm-datafono', amount: 50000 }]);
    expect(net(world.ids.accGateway)).toBe(50000);
    expect(net(world.ids.accSales)).toBe(-50000);
  });

  it('pago mixto: 2 movimientos, 2 asientos, isPaid y cambio informativo', async () => {
    const shift = await open();
    const result = await pay('cashier1', [
      { paymentMethodId: 'pm-efectivo', amount: 30000, received: 50000 },
      { paymentMethodId: 'pm-nequi', amount: 20000 },
    ]);
    expect(result).toMatchObject({ isPaid: true, change: 20000 });
    const sales = movDocs().filter((m) => m.type === 'VENTA');
    expect(sales).toHaveLength(2);
    // con turno propio, también el electrónico queda en su turno
    expect(sales.every((m) => m.shiftId === shift.id)).toBe(true);
    expect(entries().filter((e) => e.event === 'SALE')).toHaveLength(2);
    expect(orderDoc().isPaid).toBe(true);
  });

  it('reintento idempotente no duplica movimiento ni pago', async () => {
    await open();
    const first = await pay(
      'cashier1',
      [{ paymentMethodId: 'pm-efectivo', amount: 20000 }],
      'o1',
      'same-key-0001'
    );
    const second = await pay(
      'cashier1',
      [{ paymentMethodId: 'pm-efectivo', amount: 20000 }],
      'o1',
      'same-key-0001'
    );
    expect(second).toEqual(first);
    expect(movDocs().filter((m) => m.type === 'VENTA')).toHaveLength(1);
    expect(orderDoc().payments).toHaveLength(1);
  });

  it('dos cobros concurrentes no pueden superar el total: uno falla 409', async () => {
    await open();
    const results = await Promise.all([
      rejects(pay('cashier1', [{ paymentMethodId: 'pm-efectivo', amount: 30000 }])),
      rejects(pay('cashier1', [{ paymentMethodId: 'pm-nequi', amount: 30000 }])),
    ]);
    const failures = results.filter(Boolean);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ code: 'OVERPAYMENT', status: 409 });
    expect(orderDoc().payments).toHaveLength(1);
    expect(movDocs().filter((m) => m.type === 'VENTA')).toHaveLength(1);
  });

  it('pedido cancelado, eliminado o inexistente -> no se cobra', async () => {
    seedOrder(db, 'o-cancel', { statusId: 'st-cancel' });
    seedOrder(db, 'o-deleted', { isDeleted: true });
    const method = [{ paymentMethodId: 'pm-nequi', amount: 1000 }];
    expect(await rejects(pay('cashier1', method, 'o-cancel'))).toMatchObject({
      code: 'ORDER_NOT_PAYABLE',
      status: 409,
    });
    expect(await rejects(pay('cashier1', method, 'o-deleted'))).toMatchObject({
      code: 'ORDER_NOT_PAYABLE',
    });
    expect(await rejects(pay('cashier1', method, 'nope'))).toMatchObject({
      code: 'ORDER_NOT_FOUND',
      status: 404,
    });
    expect(movDocs()).toHaveLength(0);
  });

  it('validaciones: medio inexistente, recibido en electrónico o menor al monto, sobrepago', async () => {
    await open();
    expect(
      await rejects(pay('cashier1', [{ paymentMethodId: 'pm-zzz', amount: 1000 }]))
    ).toMatchObject({ code: 'METHOD_NOT_ALLOWED' });
    expect(
      await rejects(
        pay('cashier1', [{ paymentMethodId: 'pm-nequi', amount: 1000, received: 2000 }])
      )
    ).toMatchObject({ code: 'INVALID_RECEIVED' });
    expect(
      await rejects(
        pay('cashier1', [{ paymentMethodId: 'pm-efectivo', amount: 5000, received: 4000 }])
      )
    ).toMatchObject({ code: 'INVALID_RECEIVED' });
    expect(
      await rejects(pay('cashier1', [{ paymentMethodId: 'pm-efectivo', amount: 50001 }]))
    ).toMatchObject({ code: 'OVERPAYMENT' });
  });
});

describe('reverso de pagos', () => {
  it('feliz: reversa el movimiento, marca el pago y recalcula isPaid', async () => {
    await open();
    const paid = await pay('cashier1', [{ paymentMethodId: 'pm-efectivo', amount: 50000 }]);
    const paymentId = paid.payments[0].id;
    const result = await mods.payments.reverseOrderPayment(
      RID,
      { orderId: 'o1', paymentId, reason: 'se equivocó el cajero' },
      metaFor('sup1')
    );
    expect(result.isPaid).toBe(false);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0]).toMatchObject({
      reversedBy: 'sup1',
      reversalReason: 'se equivocó el cajero',
    });
    expect(orderDoc().isPaid).toBe(false);
    expect(movDocs().filter((m) => m.type === 'REVERSO')).toHaveLength(1);
    expect(net(world.ids.accSales)).toBe(0);
    // liberó lo pendiente: se puede cobrar de nuevo
    const again = await pay('cashier1', [{ paymentMethodId: 'pm-nequi', amount: 50000 }]);
    expect(again.isPaid).toBe(true);
  });

  it('reversar dos veces -> 409', async () => {
    await open();
    const paid = await pay('cashier1', [{ paymentMethodId: 'pm-efectivo', amount: 10000 }]);
    const input = { orderId: 'o1', paymentId: paid.payments[0].id, reason: 'por error' };
    await mods.payments.reverseOrderPayment(RID, input, metaFor('sup1'));
    expect(
      await rejects(mods.payments.reverseOrderPayment(RID, input, metaFor('sup1')))
    ).toMatchObject({ code: 'ALREADY_REVERSED', status: 409 });
  });

  it('turno cerrado -> 409 (se usa una devolución)', async () => {
    const shift = await open();
    const paid = await pay('cashier1', [{ paymentMethodId: 'pm-efectivo', amount: 50000 }]);
    const ack = await mods.closing.submitCount(
      RID,
      shift.id,
      { cashCount: { BILLETE_100000: 1, BILLETE_50000: 1 } },
      metaFor('cashier1')
    );
    expect(ack.status).toBe('CERRADO');
    expect(
      await rejects(
        mods.payments.reverseOrderPayment(
          RID,
          { orderId: 'o1', paymentId: paid.payments[0].id, reason: 'tarde ya' },
          metaFor('sup1')
        )
      )
    ).toMatchObject({ code: 'SHIFT_CLOSED', status: 409 });
  });

  it('pago anterior al módulo de caja (sin movementId) -> 409', async () => {
    seedOrder(db, 'o-legacy', {
      payments: [{ id: 'old1', amount: 50000, method: 'Efectivo', paidAt: 'x' }],
      isPaid: true,
    });
    expect(
      await rejects(
        mods.payments.reverseOrderPayment(
          RID,
          { orderId: 'o-legacy', paymentId: 'old1', reason: 'viejo pago' },
          metaFor('sup1')
        )
      )
    ).toMatchObject({ code: 'LEGACY_PAYMENT', status: 409 });
  });

  it('pago electrónico sin turno se puede reversar (movimiento sin turno)', async () => {
    const paid = await pay('cashier1', [{ paymentMethodId: 'pm-nequi', amount: 50000 }]);
    await mods.payments.reverseOrderPayment(
      RID,
      { orderId: 'o1', paymentId: paid.payments[0].id, reason: 'transferencia fallida' },
      metaFor('sup1')
    );
    expect(net(world.ids.accBank)).toBe(0);
    expect(orderDoc().isPaid).toBe(false);
  });
});

describe('devoluciones', () => {
  it('venta de un turno anterior: la devolución cae en el turno ACTUAL y baja su esperado', async () => {
    const first = await open();
    await pay('cashier1', [{ paymentMethodId: 'pm-efectivo', amount: 50000 }]);
    await mods.closing.submitCount(
      RID,
      first.id,
      { cashCount: { BILLETE_100000: 1, BILLETE_50000: 1 } },
      metaFor('cashier1')
    );
    const second = await open('cashier2', {});
    const result = await refund('cashier2', 20000);
    expect(result.refund).toMatchObject({
      amount: 20000,
      methodType: 'efectivo',
      refundedBy: 'cashier2',
    });
    const devolucion = movDocs().find((m) => m.type === 'DEVOLUCION')!;
    expect(devolucion.shiftId).toBe(second.id);
    expect(devolucion.shiftId).not.toBe(first.id);
    const expected = movDocs()
      .filter((m) => m.shiftId === second.id)
      .reduce((t, m) => t + (m.direction === 'IN' ? 1 : -1) * (m.amount as number), 0);
    expect(expected).toBe(-20000);
    expect(orderDoc().refunds).toHaveLength(1);
    expect(orderDoc().isPaid).toBe(true);
  });

  it('efectivo sin turno -> 409; electrónico sin turno -> caja general', async () => {
    await pay('cashier1', [{ paymentMethodId: 'pm-nequi', amount: 50000 }]);
    expect(await rejects(refund('cashier1', 1000))).toMatchObject({ code: 'SHIFT_REQUIRED' });
    await refund('cashier1', 10000, 'pm-nequi');
    const devolucion = movDocs().find((m) => m.type === 'DEVOLUCION')!;
    expect(devolucion).toMatchObject({ registerId: world.ids.general, shiftId: null });
    expect(net(world.ids.accBank)).toBe(40000);
  });

  it('no puede superar pagos vigentes − devoluciones previas', async () => {
    await open();
    await pay('cashier1', [{ paymentMethodId: 'pm-efectivo', amount: 30000 }]);
    await refund('cashier1', 25000);
    expect(await rejects(refund('cashier1', 5001))).toMatchObject({
      code: 'REFUND_LIMIT',
      status: 409,
    });
    await refund('cashier1', 5000);
    expect(orderDoc().refunds).toHaveLength(2);
  });
});
