import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

import { collectionDocs, metaFor, RID, seedCashWorld, type CashWorld } from './cashFixture';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

type Mods = {
  shifts: typeof import('@/lib/cash/shifts.server');
  movements: typeof import('@/lib/cash/movements.server');
  closing: typeof import('@/lib/cash/closing.server');
  registers: typeof import('@/lib/cash/registers.server');
};
let mods: Mods;
let world: CashWorld;

beforeAll(async () => {
  mods = {
    shifts: await import('@/lib/cash/shifts.server'),
    movements: await import('@/lib/cash/movements.server'),
    closing: await import('@/lib/cash/closing.server'),
    registers: await import('@/lib/cash/registers.server'),
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
});

const BASE = { BILLETE_100000: 1 };
const open = (
  uid: string,
  registerId = world.ids.reg1,
  openingCount: Record<string, number> = BASE,
  at?: string
) => mods.shifts.openShift(RID, { registerId, openingCount }, metaFor(uid, at));
const move = (
  uid: string,
  shiftId: string,
  input: Partial<import('@/lib/cash/movements.server').ManualMovementInput> & {
    type: import('@/lib/cash/movements.server').ManualMovementInput['type'];
    amount: number;
  },
  key?: string
) =>
  mods.movements.createManualMovement(
    RID,
    shiftId,
    { methodType: 'efectivo', reason: 'motivo de prueba', ...input },
    metaFor(uid, undefined, key)
  );
const doc = (path: string) => db.get(path) as Record<string, unknown> | undefined;
const shiftDoc = (id: string) => doc(`restaurants/${RID}/cashShifts/${id}`)!;
const movDocs = () => collectionDocs(db, 'cashMovements');
const entries = () => collectionDocs(db, 'journalEntries');
const lines = () => collectionDocs(db, 'journalLines');
const net = (accountId: string) =>
  lines()
    .filter((l) => l.accountId === accountId)
    .reduce((t, l) => t + (l.debit as number) - (l.credit as number), 0);
const lockPaths = () =>
  Array.from(db.docs.keys()).filter((p) => p.startsWith(`restaurants/${RID}/cashShiftLocks/`));
const rejects = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: Error & { code?: string; status?: number }) => error
  );

describe('apertura de turno', () => {
  it('abre con base: movimiento BASE_APERTURA, asiento caja general -> registradora y candados', async () => {
    const shift = await open('cashier1');
    expect(shift).toMatchObject({
      status: 'ABIERTO',
      cashierUid: 'cashier1',
      openingTotal: 100000,
      openingAccountingDate: '2026-03-10',
    });
    const [base] = movDocs();
    expect(base).toMatchObject({
      type: 'BASE_APERTURA',
      direction: 'IN',
      amount: 100000,
      status: 'APLICADO',
      receiptNumber: 'TR-000001',
      shiftId: shift.id,
      cashierUid: 'cashier1',
    });
    expect(base.journalEntryId).toBeTruthy();
    expect(net(world.ids.accReg1)).toBe(100000);
    expect(net(world.ids.accGeneral)).toBe(-100000);
    expect(lockPaths()).toHaveLength(2);
    expect(shift.openingMovementId).toBe(base.id);
  });

  it('sin base no genera movimiento ni asiento', async () => {
    await open('cashier1', world.ids.reg1, {});
    expect(movDocs()).toHaveLength(0);
    expect(entries()).toHaveLength(0);
  });

  it('exige caja general cuando hay base', async () => {
    db.docs.delete(`restaurants/${RID}/cashSettings/default`);
    const error = await rejects(open('cashier1'));
    expect(error?.code).toBe('NO_GENERAL_REGISTER');
  });

  it('doble apertura concurrente sobre la misma caja: solo una gana', async () => {
    const results = await Promise.allSettled([open('cashier1'), open('cashier2')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((failed.reason as { code: string }).code).toBe('REGISTER_HAS_OPEN_SHIFT');
    expect(collectionDocs(db, 'cashShifts')).toHaveLength(1);
    expect(movDocs()).toHaveLength(1);
  });

  it('el mismo cajero en dos cajas a la vez: solo una gana', async () => {
    const results = await Promise.allSettled([
      open('cashier1', world.ids.reg1),
      open('cashier1', world.ids.reg2),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((failed.reason as { code: string }).code).toBe('CASHIER_HAS_OPEN_SHIFT');
    expect(collectionDocs(db, 'cashShifts')).toHaveLength(1);
  });

  it('reintento idempotente devuelve el mismo turno sin duplicar documentos', async () => {
    const meta = metaFor('cashier1');
    const input = { registerId: world.ids.reg1, openingCount: BASE };
    const first = await mods.shifts.openShift(RID, input, meta);
    const docs = db.docs.size;
    const second = await mods.shifts.openShift(RID, input, meta);
    expect(second.id).toBe(first.id);
    expect(db.docs.size).toBe(docs);
    expect(movDocs()).toHaveLength(1);
  });

  it('getCurrentShift devuelve el turno vigente del cajero', async () => {
    expect(await mods.shifts.getCurrentShift(RID, 'cashier1')).toBeNull();
    const shift = await open('cashier1');
    expect((await mods.shifts.getCurrentShift(RID, 'cashier1'))?.id).toBe(shift.id);
  });
});

describe('movimientos', () => {
  it('ingreso y egreso en efectivo generan asiento y comprobantes RC/CE', async () => {
    const shift = await open('cashier1');
    const income = await move('cashier1', shift.id, { type: 'INGRESO_VARIO', amount: 20000 });
    const expense = await move('cashier1', shift.id, { type: 'EGRESO', amount: 5000 });
    expect(income.receiptNumber).toBe('RC-000001');
    expect(expense.receiptNumber).toBe('CE-000001');
    expect(net(world.ids.accReg1)).toBe(100000 + 20000 - 5000);
  });

  it('un medio electrónico va a la cuenta del medio y no al efectivo de la caja', async () => {
    const shift = await open('cashier1');
    await move('cashier1', shift.id, {
      type: 'INGRESO_VARIO',
      amount: 40000,
      methodType: 'nequi',
      paymentMethodId: 'pm-nequi',
    });
    expect(net(world.ids.accBank)).toBe(40000);
    expect(net(world.ids.accReg1)).toBe(100000);
  });

  it('rechaza un medio de pago que no coincide con el del restaurante', async () => {
    const shift = await open('cashier1');
    const error = await rejects(
      move('cashier1', shift.id, {
        type: 'INGRESO_VARIO',
        amount: 1000,
        methodType: 'daviplata',
        paymentMethodId: 'pm-nequi',
      })
    );
    expect(error?.code).toBe('INVALID_METHOD');
  });

  it('solo el cajero del turno registra movimientos (403)', async () => {
    const shift = await open('cashier1');
    const error = await rejects(move('intruder', shift.id, { type: 'EGRESO', amount: 1000 }));
    expect(error?.status).toBe(403);
  });

  it('reintento idempotente de un movimiento no duplica documentos', async () => {
    const shift = await open('cashier1');
    const a = await move('cashier1', shift.id, { type: 'EGRESO', amount: 3000 }, 'same-key-0001');
    const count = movDocs().length;
    const entriesCount = entries().length;
    const b = await move('cashier1', shift.id, { type: 'EGRESO', amount: 3000 }, 'same-key-0001');
    expect(b.id).toBe(a.id);
    expect(movDocs()).toHaveLength(count);
    expect(entries()).toHaveLength(entriesCount);
  });

  it('un turno EN_CIERRE rechaza movimientos nuevos', async () => {
    const shift = await open('cashier1');
    await mods.closing.startClose(RID, shift.id, { canApprove: false }, metaFor('cashier1'));
    const error = await rejects(move('cashier1', shift.id, { type: 'EGRESO', amount: 1000 }));
    expect(error?.code).toBe('INVALID_SHIFT_STATE');
    expect(error?.status).toBe(409);
  });
});

describe('retiro parcial', () => {
  it('queda pendiente sin asiento; el cajero no se autoaprueba; otro usuario aprueba', async () => {
    const shift = await open('cashier1');
    const before = entries().length;
    const withdrawal = await move('cashier1', shift.id, { type: 'RETIRO_PARCIAL', amount: 30000 });
    expect(withdrawal.status).toBe('PENDIENTE_APROBACION');
    expect(withdrawal.journalEntryId).toBeNull();
    expect(entries()).toHaveLength(before);

    const self = await rejects(
      mods.movements.decideWithdrawal(
        RID,
        shift.id,
        withdrawal.id,
        { decision: 'APROBAR' },
        metaFor('cashier1')
      )
    );
    expect(self?.status).toBe(403);

    const approved = await mods.movements.decideWithdrawal(
      RID,
      shift.id,
      withdrawal.id,
      { decision: 'APROBAR', note: 'ok' },
      metaFor('sup1')
    );
    expect(approved).toMatchObject({ status: 'APLICADO', approvedBy: 'sup1' });
    expect(approved.journalEntryId).toBeTruthy();
    expect(net(world.ids.accReg1)).toBe(70000);
    expect(net(world.ids.accGeneral)).toBe(-70000);

    const again = await rejects(
      mods.movements.decideWithdrawal(
        RID,
        shift.id,
        withdrawal.id,
        { decision: 'APROBAR' },
        metaFor('sup2')
      )
    );
    expect(again?.code).toBe('MOVEMENT_NOT_PENDING');
  });

  it('un rechazo no genera asiento y desbloquea el cierre', async () => {
    const shift = await open('cashier1');
    const withdrawal = await move('cashier1', shift.id, { type: 'RETIRO_PARCIAL', amount: 30000 });
    const blocked = await rejects(
      mods.closing.startClose(RID, shift.id, { canApprove: false }, metaFor('cashier1'))
    );
    expect(blocked?.code).toBe('PENDING_WITHDRAWALS');

    const rejected = await mods.movements.decideWithdrawal(
      RID,
      shift.id,
      withdrawal.id,
      { decision: 'RECHAZAR', note: 'no autorizado' },
      metaFor('sup1')
    );
    expect(rejected.status).toBe('RECHAZADO');
    expect(net(world.ids.accReg1)).toBe(100000);
    const ack = await mods.closing.startClose(
      RID,
      shift.id,
      { canApprove: false },
      metaFor('cashier1')
    );
    expect(ack.status).toBe('EN_CIERRE');
  });

  it('solo retiros en efectivo', async () => {
    const shift = await open('cashier1');
    const error = await rejects(
      move('cashier1', shift.id, { type: 'RETIRO_PARCIAL', amount: 1000, methodType: 'nequi' })
    );
    expect(error?.code).toBe('INVALID_METHOD');
  });
});

describe('reversos', () => {
  const reverse = (uid: string, movementId: string, key?: string) =>
    mods.movements.reverseMovement(
      RID,
      movementId,
      { reason: 'error de digitación' },
      metaFor(uid, undefined, key)
    );

  it('crea movimiento opuesto, contra-asiento y marca el original', async () => {
    const shift = await open('cashier1');
    const expense = await move('cashier1', shift.id, { type: 'EGRESO', amount: 8000 });
    const reversal = await reverse('sup1', expense.id);
    expect(reversal).toMatchObject({
      type: 'REVERSO',
      direction: 'IN',
      amount: 8000,
      shiftId: shift.id,
      reversesMovementId: expense.id,
      receiptNumber: 'RV-000001',
    });
    expect(doc(`restaurants/${RID}/cashMovements/${expense.id}`)?.reversedByMovementId).toBe(
      reversal.id
    );
    expect(net(world.ids.accReg1)).toBe(100000);
  });

  it('no se puede reversar dos veces ni reversar un reverso', async () => {
    const shift = await open('cashier1');
    const expense = await move('cashier1', shift.id, { type: 'EGRESO', amount: 8000 });
    const reversal = await reverse('sup1', expense.id);
    expect((await rejects(reverse('sup1', expense.id)))?.code).toBe('ALREADY_REVERSED');
    expect((await rejects(reverse('sup1', reversal.id)))?.code).toBe('NOT_REVERSIBLE');
  });

  it('no reversa la base de apertura', async () => {
    await open('cashier1');
    const [base] = movDocs();
    expect((await rejects(reverse('sup1', base.id as string)))?.code).toBe('NOT_REVERSIBLE');
  });

  it('en un turno cerrado sugiere una devolución (409)', async () => {
    const shift = await open('cashier1');
    const expense = await move('cashier1', shift.id, { type: 'EGRESO', amount: 8000 });
    await mods.closing.submitCount(
      RID,
      shift.id,
      {
        cashCount: {
          BILLETE_50000: 1,
          BILLETE_20000: 1,
          BILLETE_10000: 1,
          BILLETE_5000: 2,
          BILLETE_2000: 1,
        },
      },
      metaFor('cashier1')
    );
    expect(shiftDoc(shift.id).status).toBe('CERRADO');
    const error = await rejects(reverse('sup1', expense.id));
    expect(error?.code).toBe('SHIFT_CLOSED');
    expect(error?.status).toBe(409);
  });

  it('reintento idempotente del reverso no duplica', async () => {
    const shift = await open('cashier1');
    const expense = await move('cashier1', shift.id, { type: 'EGRESO', amount: 8000 });
    const a = await reverse('sup1', expense.id, 'rev-key-00001');
    const total = movDocs().length;
    const b = await reverse('sup1', expense.id, 'rev-key-00001');
    expect(b.id).toBe(a.id);
    expect(movDocs()).toHaveLength(total);
  });
});

describe('cierre a ciegas', () => {
  it('dentro del umbral cierra solo: ajuste + traslado + candados liberados', async () => {
    const shift = await open('cashier1');
    await move('cashier1', shift.id, { type: 'INGRESO_VARIO', amount: 20000 });
    // esperado 120.000; cuenta 119.500 (faltante 500 <= umbral 1.000)
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
    expect(Object.keys(ack).sort()).toEqual(['shiftId', 'status']);
    expect(ack.status).toBe('CERRADO');

    const types = movDocs().map((m) => m.type);
    expect(types).toContain('AJUSTE_FALTANTE');
    expect(types).toContain('TRASLADO_CIERRE');
    expect(lockPaths()).toHaveLength(0);
    expect(net(world.ids.accReg1)).toBe(0);
    expect(net(world.ids.accReceivable)).toBe(500);
    expect(shiftDoc(shift.id)).toMatchObject({ status: 'CERRADO', closingId: shift.id });
    const closing = doc(`restaurants/${RID}/cashClosings/${shift.id}`)!;
    expect(closing).toMatchObject({ status: 'CERRADO', cashDifference: -500, countedCash: 119500 });
  });

  it('sobrante dentro del umbral usa CASH_SURPLUS', async () => {
    const shift = await open('cashier1');
    await mods.closing.submitCount(
      RID,
      shift.id,
      { cashCount: { BILLETE_100000: 1, MONEDA_500: 1 } },
      metaFor('cashier1')
    );
    expect(movDocs().map((m) => m.type)).toContain('AJUSTE_SOBRANTE');
    expect(net(world.ids.accReg1)).toBe(0);
  });

  it('sobre el umbral sin justificación -> 400; con justificación queda pendiente', async () => {
    const shift = await open('cashier1');
    const missing = await rejects(
      mods.closing.submitCount(
        RID,
        shift.id,
        { cashCount: { BILLETE_50000: 1 } },
        metaFor('cashier1')
      )
    );
    expect(missing?.code).toBe('JUSTIFICATION_REQUIRED');
    expect(missing?.status).toBe(400);
    expect(shiftDoc(shift.id).status).toBe('ABIERTO');

    const ack = await mods.closing.submitCount(
      RID,
      shift.id,
      { cashCount: { BILLETE_50000: 1 }, justification: 'Se me cayó dinero' },
      metaFor('cashier1')
    );
    expect(ack).toEqual({ shiftId: shift.id, status: 'CERRADO_PENDIENTE_APROBACION' });
    expect(lockPaths()).toHaveLength(2);
    expect(movDocs()).toHaveLength(1);
  });

  it('un turno pendiente ya no admite movimientos ni reversos', async () => {
    const shift = await open('cashier1');
    const expense = await move('cashier1', shift.id, { type: 'EGRESO', amount: 1000 });
    await mods.closing.submitCount(
      RID,
      shift.id,
      { cashCount: { BILLETE_50000: 1 }, justification: 'diferencia grande' },
      metaFor('cashier1')
    );
    expect(
      (await rejects(move('cashier1', shift.id, { type: 'EGRESO', amount: 1000 })))?.code
    ).toBe('INVALID_SHIFT_STATE');
    const rev = await rejects(
      mods.movements.reverseMovement(RID, expense.id, { reason: 'motivo valido' }, metaFor('sup1'))
    );
    expect(rev?.code).toBe('SHIFT_CLOSED');
  });

  it('la aprobación la hace otro: el cajero recibe 403; el supervisor cierra reasignando el faltante', async () => {
    const shift = await open('cashier1');
    await mods.closing.submitCount(
      RID,
      shift.id,
      { cashCount: { BILLETE_50000: 1 }, justification: 'faltó dinero en caja' },
      metaFor('cashier1')
    );
    const input = { decision: 'APROBAR' as const, note: 'revisado con cámaras' };
    const self = await rejects(
      mods.closing.approveClose(RID, shift.id, input, metaFor('cashier1'))
    );
    expect(self?.status).toBe(403);

    const closing = await mods.closing.approveClose(
      RID,
      shift.id,
      { ...input, shortageAccountId: world.ids.accExpense },
      metaFor('sup1')
    );
    expect(closing).toMatchObject({
      status: 'CERRADO',
      cashDifference: -50000,
      approval: { approvedBy: 'sup1', shortageAccountId: world.ids.accExpense },
    });
    expect(shiftDoc(shift.id)).toMatchObject({ status: 'CERRADO', approvedBy: 'sup1' });
    expect(net(world.ids.accExpense)).toBe(50000);
    expect(net(world.ids.accReceivable)).toBe(0);
    expect(net(world.ids.accReg1)).toBe(0);
    expect(lockPaths()).toHaveLength(0);

    const again = await rejects(mods.closing.approveClose(RID, shift.id, input, metaFor('sup2')));
    expect(again?.code).toBe('INVALID_SHIFT_STATE');
  });

  it('sin override el faltante aprobado va a la cuenta por defecto (1365)', async () => {
    const shift = await open('cashier1');
    await mods.closing.submitCount(
      RID,
      shift.id,
      { cashCount: { BILLETE_50000: 1 }, justification: 'faltó dinero en caja' },
      metaFor('cashier1')
    );
    await mods.closing.approveClose(
      RID,
      shift.id,
      { decision: 'APROBAR', note: 'se descuenta al cajero' },
      metaFor('sup1')
    );
    expect(net(world.ids.accReceivable)).toBe(50000);
  });

  it('solo el cajero del turno envía el conteo (403)', async () => {
    const shift = await open('cashier1');
    const error = await rejects(
      mods.closing.submitCount(RID, shift.id, { cashCount: BASE }, metaFor('cashier2'))
    );
    expect(error?.status).toBe(403);
  });

  it('un conteo con denominación desconocida es inválido', async () => {
    const shift = await open('cashier1');
    const error = await rejects(
      mods.closing.submitCount(RID, shift.id, { cashCount: { BILLETE_3: 1 } }, metaFor('cashier1'))
    );
    expect(error?.code).toBe('INVALID_COUNT');
  });

  it('cierre pasada la medianoche: el turno conserva el día de apertura y el cierre usa el de hoy', async () => {
    const shift = await open('cashier1', world.ids.reg1, BASE, '2026-10-31T03:30:00.000Z');
    expect(shift.openingAccountingDate).toBe('2026-10-30');
    const ack = await mods.closing.submitCount(
      RID,
      shift.id,
      { cashCount: BASE },
      metaFor('cashier1', '2026-10-31T06:00:00.000Z')
    );
    expect(ack.status).toBe('CERRADO');
    expect(shiftDoc(shift.id).openingAccountingDate).toBe('2026-10-30');
    const byType = Object.fromEntries(movDocs().map((m) => [m.type as string, m]));
    expect(byType.BASE_APERTURA.accountingDate).toBe('2026-10-30');
    expect(byType.TRASLADO_CIERRE.accountingDate).toBe('2026-10-31');
    const entryDates = Object.fromEntries(
      entries().map((e) => [e.sourceId as string, e.accountingDate])
    );
    expect(entryDates[byType.BASE_APERTURA.id as string]).toBe('2026-10-30');
    expect(entryDates[byType.TRASLADO_CIERRE.id as string]).toBe('2026-10-31');
  });

  it('start-close: solo el cajero o un supervisor', async () => {
    const shift = await open('cashier1');
    const denied = await rejects(
      mods.closing.startClose(RID, shift.id, { canApprove: false }, metaFor('cashier2'))
    );
    expect(denied?.status).toBe(403);
    const ok = await mods.closing.startClose(RID, shift.id, { canApprove: true }, metaFor('sup1'));
    expect(ok.status).toBe('EN_CIERRE');
    const twice = await rejects(
      mods.closing.startClose(RID, shift.id, { canApprove: true }, metaFor('sup1'))
    );
    expect(twice?.code).toBe('INVALID_SHIFT_STATE');
  });
});

describe('integración: turno completo', () => {
  it('abrir -> movimientos -> retiro aprobado -> cierre con faltante -> aprobación', async () => {
    const shift = await open('cashier1');
    await move('cashier1', shift.id, { type: 'INGRESO_VARIO', amount: 30000 });
    await move('cashier1', shift.id, { type: 'INGRESO_VARIO', amount: 20000 });
    await move('cashier1', shift.id, { type: 'EGRESO', amount: 15000 });
    await move('cashier1', shift.id, {
      type: 'INGRESO_VARIO',
      amount: 40000,
      methodType: 'nequi',
      paymentMethodId: 'pm-nequi',
    });
    const withdrawal = await move('cashier1', shift.id, { type: 'RETIRO_PARCIAL', amount: 50000 });
    await mods.movements.decideWithdrawal(
      RID,
      shift.id,
      withdrawal.id,
      { decision: 'APROBAR', note: 'ok' },
      metaFor('sup1')
    );

    // esperado en efectivo: 100.000 + 30.000 + 20.000 - 15.000 - 50.000 = 85.000; se cuentan 83.000
    const ack = await mods.closing.submitCount(
      RID,
      shift.id,
      {
        cashCount: {
          BILLETE_50000: 1,
          BILLETE_20000: 1,
          BILLETE_10000: 1,
          BILLETE_2000: 1,
          BILLETE_1000: 1,
        },
        declaredByMethod: { nequi: 40000 },
        justification: 'faltante al contar',
      },
      metaFor('cashier1')
    );
    expect(ack.status).toBe('CERRADO_PENDIENTE_APROBACION');
    const snapshot = doc(`restaurants/${RID}/cashClosings/${shift.id}`)!;
    expect(snapshot).toMatchObject({
      expectedByMethod: { efectivo: 85000, nequi: 40000 },
      cashDifference: -2000,
      differenceByMethod: { efectivo: -2000, nequi: 0 },
    });

    await mods.closing.approveClose(
      RID,
      shift.id,
      { decision: 'APROBAR', note: 'aprobado', shortageAccountId: world.ids.accExpense },
      metaFor('sup1')
    );

    // Todos los asientos cuadran y el libro completo está en equilibrio
    const all = entries();
    expect(all).toHaveLength(8);
    all.forEach((e) => expect(e.totalDebit).toBe(e.totalCredit));
    const debits = lines().reduce((t, l) => t + (l.debit as number), 0);
    const credits = lines().reduce((t, l) => t + (l.credit as number), 0);
    expect(debits).toBe(credits);

    // La registradora queda en cero; la general recibe lo contado y retirado
    expect(net(world.ids.accReg1)).toBe(0);
    expect(net(world.ids.accGeneral)).toBe(-100000 + 50000 + 83000);
    expect(net(world.ids.accBank)).toBe(40000);
    expect(net(world.ids.accExpense)).toBe(15000 + 2000);

    // Consecutivos sin huecos
    const numbers = (prefix: string) =>
      movDocs()
        .map((m) => m.receiptNumber as string)
        .filter((n) => n.startsWith(`${prefix}-`))
        .sort();
    expect(numbers('RC')).toEqual(['RC-000001', 'RC-000002', 'RC-000003']);
    expect(numbers('CE')).toEqual(['CE-000001', 'CE-000002']);
    expect(numbers('TR')).toEqual(['TR-000001', 'TR-000002', 'TR-000003']);
    expect(all.map((e) => e.number as string).sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `CC-${String(i + 1).padStart(6, '0')}`)
    );
    expect(doc(`restaurants/${RID}/sequences/journal`)).toMatchObject({ current: 8 });
    expect(lockPaths()).toHaveLength(0);
  });
});
