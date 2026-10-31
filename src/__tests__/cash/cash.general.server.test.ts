// @vitest-environment node
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
  general: typeof import('@/lib/cash/general.server');
  settlements: typeof import('@/lib/cash/settlements.server');
  balance: typeof import('@/lib/cash/balance.server');
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
const allMovs = () => collectionDocs(db, 'cashMovements');
const entries = () => collectionDocs(db, 'journalEntries');
const lines = () => collectionDocs(db, 'journalLines');
const lockPaths = () =>
  Array.from(db.docs.keys()).filter((p) => p.startsWith(`restaurants/${RID}/cashShiftLocks/`));
const rejects = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: Error & { code?: string; status?: number }) => error
  );
const net = (accountId: string) =>
  lines()
    .filter((l) => l.accountId === accountId)
    .reduce((t, l) => t + (l.debit as number) - (l.credit as number), 0);
const open = (uid = 'cashier1', registerId = world.ids.reg1, count = BASE) =>
  mods.shifts.openShift(RID, { registerId, openingCount: count }, metaFor(uid));
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

describe('espejos de traslados en la caja general', () => {
  it('la base de apertura crea un espejo sin turno con el mismo asiento (uno solo)', async () => {
    const shift = await open();
    const base = allMovs().find((m) => m.type === 'BASE_APERTURA' && !m.mirrorOfMovementId)!;
    const mirror = allMovs().find((m) => m.mirrorOfMovementId === base.id)!;
    expect(mirror).toMatchObject({
      registerId: world.ids.general,
      shiftId: null,
      direction: 'OUT',
      transferId: base.transferId,
      journalEntryId: base.journalEntryId,
      amount: 100000,
    });
    expect(base.shiftId).toBe(shift.id);
    expect(entries()).toHaveLength(1);
    // el espejo no cuenta en el esperado del turno
    expect(allMovs().filter((m) => m.shiftId === shift.id)).toHaveLength(1);
    expect((await mods.balance.getRegisterBalance(RID, world.ids.general)).cash).toBe(-100000);
  });

  it('retiro: sin espejo mientras está pendiente; con espejo al aprobarse; reverso espeja de vuelta', async () => {
    const shift = await open();
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
    expect(allMovs().filter((m) => m.mirrorOfMovementId === withdrawal.id)).toHaveLength(0);
    await mods.movements.decideWithdrawal(
      RID,
      shift.id,
      withdrawal.id,
      { decision: 'APROBAR' },
      metaFor('sup1')
    );
    const mirror = allMovs().find((m) => m.mirrorOfMovementId === withdrawal.id)!;
    expect(mirror).toMatchObject({ direction: 'IN', shiftId: null, registerId: world.ids.general });
    expect(mirror.journalEntryId).toBeTruthy();
    expect(entries()).toHaveLength(2);
    expect((await mods.balance.getRegisterBalance(RID, world.ids.general)).cash).toBe(-70000);

    const reversal = await mods.movements.reverseMovement(
      RID,
      withdrawal.id,
      { reason: 'no era necesario' },
      metaFor('sup1')
    );
    expect(allMovs().find((m) => m.mirrorOfMovementId === reversal.id)).toMatchObject({
      direction: 'OUT',
    });
    expect((await mods.balance.getRegisterBalance(RID, world.ids.general)).cash).toBe(-100000);
    // el espejo no se reversa por su cuenta
    expect(
      await rejects(
        mods.movements.reverseMovement(
          RID,
          mirror.id as string,
          { reason: 'intento' },
          metaFor('sup1')
        )
      )
    ).toMatchObject({
      code: 'NOT_REVERSIBLE',
    });
  });

  it('traslado de cierre crea espejo; la general recupera lo contado', async () => {
    const shift = await open();
    await mods.closing.submitCount(RID, shift.id, { cashCount: BASE }, metaFor('cashier1'));
    const transfer = allMovs().find((m) => m.type === 'TRASLADO_CIERRE' && !m.mirrorOfMovementId)!;
    expect(allMovs().find((m) => m.mirrorOfMovementId === transfer.id)).toMatchObject({
      direction: 'IN',
      shiftId: null,
      journalEntryId: transfer.journalEntryId,
    });
    expect((await mods.balance.getRegisterBalance(RID, world.ids.general)).cash).toBe(0);
  });

  it('si el asiento se omite (misma cuenta), el espejo igual existe', async () => {
    const twin = await mods.registers.createRegister(
      RID,
      {
        type: 'REGISTRADORA',
        name: 'Caja 3',
        ledgerAccountId: world.ids.accGeneral,
        diffThreshold: 0,
      },
      metaFor('admin')
    );
    await open('cashier3', twin.id);
    const base = allMovs().find((m) => m.type === 'BASE_APERTURA' && !m.mirrorOfMovementId)!;
    expect(base).toMatchObject({ journalEntryId: null, journalSkippedReason: 'SAME_ACCOUNT' });
    expect(allMovs().find((m) => m.mirrorOfMovementId === base.id)).toMatchObject({
      journalEntryId: null,
      journalSkippedReason: 'SAME_ACCOUNT',
    });
    expect(entries()).toHaveLength(0);
  });
});

describe('operaciones de la caja general', () => {
  it('saldo inicial con contrapartida elegida: D caja general C patrimonio', async () => {
    const movement = await loadInitial(500000);
    expect(movement).toMatchObject({
      shiftId: null,
      registerId: world.ids.general,
      direction: 'IN',
    });
    expect(net(world.ids.accGeneral)).toBe(500000);
    expect(net(world.ids.accEquity)).toBe(-500000);
    expect((await mods.balance.getRegisterBalance(RID, world.ids.general)).cash).toBe(500000);
  });

  it('solo cajas generales; egreso sobre el saldo -> 409', async () => {
    expect(
      await rejects(
        mods.general.createGeneralMovement(
          RID,
          world.ids.reg1,
          { type: 'INGRESO_VARIO', amount: 1000, reason: 'no es general' },
          metaFor('acc1')
        )
      )
    ).toMatchObject({ code: 'INVALID_REGISTER' });
    await loadInitial(10000);
    expect(
      await rejects(
        mods.general.createGeneralMovement(
          RID,
          world.ids.general,
          { type: 'EGRESO', amount: 10001, reason: 'más de lo que hay' },
          metaFor('acc1')
        )
      )
    ).toMatchObject({ code: 'INSUFFICIENT_CASH', status: 409 });
  });

  it('consignación: feliz (D banco C caja general) y por encima del saldo -> 409', async () => {
    await loadInitial(300000);
    const deposit = await mods.general.depositToBank(
      RID,
      {
        registerId: world.ids.general,
        bankAccountId: world.ids.accBank,
        amount: 200000,
        externalRef: 'CONS-123',
      },
      metaFor('acc1')
    );
    expect(deposit).toMatchObject({ type: 'CONSIGNACION', direction: 'OUT', shiftId: null });
    expect(deposit.receiptNumber).toMatch(/^TR-/);
    expect(net(world.ids.accBank)).toBe(200000);
    expect(net(world.ids.accGeneral)).toBe(100000);
    const over = await rejects(
      mods.general.depositToBank(
        RID,
        {
          registerId: world.ids.general,
          bankAccountId: world.ids.accBank,
          amount: 100001,
          externalRef: 'CONS-124',
        },
        metaFor('acc1')
      )
    );
    expect(over).toMatchObject({ code: 'INSUFFICIENT_CASH', status: 409 });
    const notAsset = await rejects(
      mods.general.depositToBank(
        RID,
        {
          registerId: world.ids.general,
          bankAccountId: world.ids.accSales,
          amount: 1000,
          externalRef: 'CONS-125',
        },
        metaFor('acc1')
      )
    );
    expect(notAsset).toMatchObject({ code: 'INVALID_LEDGER_ACCOUNT' });
  });

  it('liquidación del datáfono: asiento D banco C 1380, sin movimiento de caja', async () => {
    const result = await mods.settlements.registerSettlement(
      RID,
      {
        paymentMethodId: 'pm-datafono',
        bankAccountId: world.ids.accBank,
        amount: 80000,
        externalRef: 'LIQ-9',
      },
      metaFor('acc1')
    );
    expect(result.entryNumber).toMatch(/^CC-/);
    expect(net(world.ids.accBank)).toBe(80000);
    expect(net(world.ids.accGateway)).toBe(-80000);
    expect(allMovs()).toHaveLength(0);
    expect(
      await rejects(
        mods.settlements.registerSettlement(
          RID,
          {
            paymentMethodId: 'pm-nequi',
            bankAccountId: world.ids.accBank,
            amount: 1,
            externalRef: 'x',
          },
          metaFor('acc1')
        )
      )
    ).toMatchObject({ code: 'INVALID_METHOD' });
  });
});

describe('seguimientos de 2a', () => {
  it('conteo pendiente libera al cajero (abre otro turno) y mantiene el candado de la caja', async () => {
    const first = await open('cashier1', world.ids.reg1);
    const ack = await mods.closing.submitCount(
      RID,
      first.id,
      { cashCount: { BILLETE_50000: 1 }, justification: 'se perdió un billete' },
      metaFor('cashier1')
    );
    expect(ack.status).toBe('CERRADO_PENDIENTE_APROBACION');
    expect(lockPaths()).toHaveLength(1);
    // la caja sigue ocupada
    expect(await rejects(open('cashier2', world.ids.reg1))).toMatchObject({
      code: 'REGISTER_HAS_OPEN_SHIFT',
    });
    // el cajero puede abrir en otra caja
    const second = await open('cashier1', world.ids.reg2, { BILLETE_50000: 1 });
    expect(lockPaths()).toHaveLength(3);
    await mods.closing.approveClose(
      RID,
      first.id,
      { decision: 'APROBAR', note: 'aprobado', shortageAccountId: world.ids.accExpense },
      metaFor('sup1')
    );
    // aprobar el cierre viejo NO borra el candado del turno nuevo
    expect(lockPaths().sort()).toEqual(
      [
        `restaurants/${RID}/cashShiftLocks/cashier_cashier1`,
        `restaurants/${RID}/cashShiftLocks/register_${world.ids.reg2}`,
      ].sort()
    );
    expect((await mods.shifts.getCurrentShift(RID, 'cashier1'))?.id).toBe(second.id);
  });

  it('no se cambia la cuenta contable de una caja con turno abierto', async () => {
    const shift = await open();
    const attempt = () =>
      mods.registers.updateRegister(
        RID,
        world.ids.reg1,
        { ledgerAccountId: world.ids.accReceivable },
        metaFor('admin')
      );
    expect(await rejects(attempt())).toMatchObject({
      code: 'REGISTER_HAS_OPEN_SHIFT',
      status: 409,
    });
    // renombrar sí se puede
    await mods.registers.updateRegister(
      RID,
      world.ids.reg1,
      { name: 'Caja uno' },
      metaFor('admin')
    );
    await mods.closing.submitCount(RID, shift.id, { cashCount: BASE }, metaFor('cashier1'));
    expect(await rejects(attempt())).toBeNull();
  });

  it('lista de movimientos del turno: el cajero sin totales; el supervisor con totales', async () => {
    const shift = await open();
    const asCashier = await mods.balance.listShiftMovements(RID, shift.id, {
      uid: 'cashier1',
      canApprove: false,
    });
    expect(asCashier.movements).toHaveLength(1);
    expect(asCashier.totalsByMethod).toBeUndefined();
    expect(JSON.stringify(asCashier)).not.toMatch(/"audit"/);
    const asSupervisor = await mods.balance.listShiftMovements(RID, shift.id, {
      uid: 'sup1',
      canApprove: true,
    });
    expect(asSupervisor.totalsByMethod).toEqual({ efectivo: 100000 });
    expect(
      await rejects(
        mods.balance.listShiftMovements(RID, shift.id, { uid: 'otro', canApprove: false })
      )
    ).toMatchObject({ code: 'SHIFT_NOT_FOUND' });
  });
});
