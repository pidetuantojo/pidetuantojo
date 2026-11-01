// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestore } from '../../orders/fakeFirestore';
import { collectionDocs, metaFor, nextKey, RID } from '../cashFixture';

import {
  assertFundInvariant,
  ATTACHMENT,
  expenseInput,
  FUND,
  generalSource,
  loadPettyMods,
  MAX_EXPENSE,
  readPettyState,
  seedPettyWorld,
  type PettyMods,
  type PettyWorld,
} from './pettyFixture';

const db = new FakeFirestore();
vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: {} }));

let m: PettyMods;
let w: PettyWorld;
beforeAll(async () => {
  m = await loadPettyMods();
});
beforeEach(async () => {
  db.docs.clear();
  w = await seedPettyWorld(db, m);
});

const movements = () => collectionDocs(db, 'cashMovements');
const lines = () => collectionDocs(db, 'journalLines');
const net = (accountId: string) =>
  lines()
    .filter((l) => l.accountId === accountId)
    .reduce((t, l) => t + (l.debit as number) - (l.credit as number), 0);
const cashOf = (registerId: string) =>
  (
    db.get(`restaurants/${RID}/cashRegisterBalances/${registerId}`) as {
      byMethod: { efectivo?: number };
    }
  ).byMethod.efectivo ?? 0;

const constitute = (target = FUND, source = generalSource(w)) =>
  m.fund.setPettyFund(RID, w.petty.register, { targetAmount: target, source }, metaFor('boss'));
const expense = (amount: number, overrides: Record<string, unknown> = {}) =>
  m.expenses.createExpense(RID, expenseInput(w, amount, overrides), metaFor('petty1'));
const legalized = async (amount: number) => {
  const e = await expense(amount);
  await m.expenses.addAttachment(RID, e.id, ATTACHMENT, metaFor('petty1'));
  return m.expenses.legalizeExpense(RID, e.id, metaFor('petty1'));
};
const request = (ids: string[], uid = 'petty1') =>
  m.reimbursements.requestReimbursement(
    RID,
    { registerId: w.petty.register, expenseIds: ids },
    metaFor(uid)
  );

describe('fondo fijo', () => {
  it('constituye desde la caja general: movimiento, espejo, asiento y fondo', async () => {
    const res = await constitute();
    expect(res).toMatchObject({ previousFund: 0, fundAmount: FUND });
    expect(cashOf(w.petty.register)).toBe(FUND);
    expect(cashOf(w.ids.general)).toBe(1000000 - FUND);
    const fundMovements = movements().filter((x) => x.type === 'REPOSICION_CAJA_MENOR');
    expect(fundMovements).toHaveLength(2); // movimiento + espejo
    expect(fundMovements.map((x) => x.direction).sort()).toEqual(['IN', 'OUT']);
    expect(net(w.petty.accPetty)).toBe(FUND);
    expect(net(w.ids.accGeneral)).toBe(1000000 - FUND);
    expect(readPettyState(db, w).register.fundConstitutedAt).toBeTruthy();
    assertFundInvariant(db, w);
  });

  it('constituye desde un banco: sin espejo y con la cuenta bancaria al crédito', async () => {
    await constitute(FUND, { kind: 'BANK', bankAccountId: w.ids.accBank } as never);
    expect(movements().filter((x) => x.type === 'REPOSICION_CAJA_MENOR')).toHaveLength(1);
    expect(net(w.petty.accPetty)).toBe(FUND);
    expect(net(w.ids.accBank)).toBe(-FUND);
    expect(cashOf(w.ids.general)).toBe(1000000);
    assertFundInvariant(db, w);
  });

  it('ajusta hacia arriba y hacia abajo devolviendo a la caja general', async () => {
    await constitute();
    await constitute(300000);
    expect(cashOf(w.petty.register)).toBe(300000);
    expect(cashOf(w.ids.general)).toBe(1000000 - 300000);
    assertFundInvariant(db, w);

    const down = await constitute(120000);
    expect(down.movement.type).toBe('DEVOLUCION_FONDO');
    expect(cashOf(w.petty.register)).toBe(120000);
    expect(cashOf(w.ids.general)).toBe(1000000 - 120000);
    expect(net(w.petty.accPetty)).toBe(120000);
    assertFundInvariant(db, w);
  });

  it('no baja el fondo por debajo de lo que hay en efectivo', async () => {
    await constitute();
    await expense(50000);
    await expense(50000);
    // efectivo 100.000 + vales 100.000: bajar a 60.000 exigiría devolver 140.000
    await expect(constitute(60000)).rejects.toMatchObject({ code: 'INSUFFICIENT_CASH' });
    assertFundInvariant(db, w);
  });

  it('rechaza ajustes sin cambio, bajo el máximo por gasto o con caja general sin efectivo', async () => {
    await constitute();
    await expect(constitute(FUND)).rejects.toMatchObject({ code: 'INVALID_FUND' });
    await expect(constitute(MAX_EXPENSE - 1)).rejects.toMatchObject({ code: 'INVALID_FUND' });
    await expect(constitute(5000000)).rejects.toMatchObject({ code: 'INSUFFICIENT_CASH' });
  });

  it('reintento con la misma llave no duplica el movimiento', async () => {
    const meta = metaFor('boss');
    const input = { targetAmount: FUND, source: generalSource(w) };
    const a = await m.fund.setPettyFund(RID, w.petty.register, input, meta);
    const b = await m.fund.setPettyFund(RID, w.petty.register, input, meta);
    expect(b.movement.id).toBe(a.movement.id);
    expect(cashOf(w.petty.register)).toBe(FUND);
  });
});

describe('gastos', () => {
  beforeEach(async () => {
    await constitute();
  });

  it('registra un vale pendiente sin asiento y saca el efectivo', async () => {
    const e = await expense(30000);
    expect(e).toMatchObject({ status: 'PENDIENTE', amount: 30000, reimbursementId: null });
    expect(e.voucherNumber).toMatch(/^VCM-\d{6}$/);
    const movement = movements().find((x) => x.id === e.movementId)!;
    expect(movement).toMatchObject({
      type: 'GASTO_CAJA_MENOR',
      direction: 'OUT',
      journalEntryId: null,
      journalSkippedReason: 'RECOGNIZED_ON_REIMBURSEMENT',
    });
    expect(cashOf(w.petty.register)).toBe(FUND - 30000);
    expect(net(w.petty.accPetty)).toBe(FUND); // sin reconocimiento contable todavía
    assertFundInvariant(db, w);
  });

  it('rechaza montos sobre el máximo (400) y sobre el efectivo (409)', async () => {
    await expect(expense(MAX_EXPENSE + 1)).rejects.toMatchObject({
      code: 'EXPENSE_LIMIT_EXCEEDED',
      status: 400,
    });
    for (let i = 0; i < 4; i++) await expense(MAX_EXPENSE); // efectivo: 0
    await expect(expense(1000)).rejects.toMatchObject({
      code: 'INSUFFICIENT_CASH',
      status: 409,
    });
    assertFundInvariant(db, w);
  });

  it('exige fondo constituido', async () => {
    db.docs.clear();
    w = await seedPettyWorld(db, m);
    await expect(expense(1000)).rejects.toMatchObject({ code: 'FUND_NOT_CONSTITUTED' });
  });

  it('no deja registrar con una categoría inactiva', async () => {
    await m.categories.updateCategory(
      RID,
      w.categories.aseo,
      { isActive: false },
      metaFor('petty1')
    );
    await expect(expense(1000)).rejects.toMatchObject({ code: 'PETTY_CATEGORY_NOT_FOUND' });
  });

  it('legalizar sin adjunto es 409; con adjunto pasa a LEGALIZADO', async () => {
    const e = await expense(10000);
    await expect(m.expenses.legalizeExpense(RID, e.id, metaFor('petty1'))).rejects.toMatchObject({
      code: 'ATTACHMENT_REQUIRED',
      status: 409,
    });
    await m.expenses.addAttachment(RID, e.id, ATTACHMENT, metaFor('petty1'));
    const done = await m.expenses.legalizeExpense(RID, e.id, metaFor('petty1'));
    expect(done.status).toBe('LEGALIZADO');
    await expect(m.expenses.legalizeExpense(RID, e.id, metaFor('petty1'))).rejects.toMatchObject({
      code: 'INVALID_EXPENSE_STATE',
    });
  });

  it('anular devuelve el efectivo sin asiento y deja el fondo cuadrado', async () => {
    const e = await expense(40000);
    expect(cashOf(w.petty.register)).toBe(FUND - 40000);
    const annulled = await m.expenses.annulExpense(
      RID,
      e.id,
      'Compra duplicada',
      metaFor('petty1')
    );
    expect(annulled.status).toBe('ANULADO');
    expect(cashOf(w.petty.register)).toBe(FUND);
    const reversal = movements().find((x) => x.id === annulled.reversalMovementId)!;
    expect(reversal).toMatchObject({ type: 'REVERSO', direction: 'IN', journalEntryId: null });
    assertFundInvariant(db, w);
    await expect(
      m.expenses.annulExpense(RID, e.id, 'Otra vez no', metaFor('petty1'))
    ).rejects.toMatchObject({ code: 'INVALID_EXPENSE_STATE' });
  });

  it('retry idempotente del mismo registro no duplica el gasto', async () => {
    const meta = metaFor('petty1');
    const input = expenseInput(w, 12000);
    const a = await m.expenses.createExpense(RID, input, meta);
    const b = await m.expenses.createExpense(RID, input, meta);
    expect(b.id).toBe(a.id);
    expect(readPettyState(db, w).expenses).toHaveLength(1);
    expect(cashOf(w.petty.register)).toBe(FUND - 12000);
  });

  it('gastos concurrentes no pueden sobregirar el efectivo', async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        m.expenses.createExpense(RID, expenseInput(w, MAX_EXPENSE), {
          audit: metaFor('petty1').audit,
          idempotencyKey: nextKey(),
        })
      )
    );
    const ok = attempts.filter((a) => a.status === 'fulfilled');
    expect(ok).toHaveLength(FUND / MAX_EXPENSE);
    expect(cashOf(w.petty.register)).toBe(0);
    assertFundInvariant(db, w);
  });
});

describe('reembolsos', () => {
  beforeEach(async () => {
    await constitute();
  });

  it('solo acepta gastos legalizados y libres', async () => {
    const pending = await expense(10000);
    await expect(request([pending.id])).rejects.toMatchObject({ code: 'INVALID_EXPENSE_STATE' });

    const ok = await legalized(20000);
    const rb = await request([ok.id]);
    expect(rb).toMatchObject({
      total: 20000,
      status: 'PENDIENTE_APROBACION',
      requestedBy: 'petty1',
    });
    // el mismo gasto en dos reembolsos
    await expect(request([ok.id])).rejects.toMatchObject({ code: 'INVALID_EXPENSE_STATE' });
    // un gasto en un reembolso activo no se puede anular
    await expect(
      m.expenses.annulExpense(RID, ok.id, 'Ya no aplica', metaFor('petty1'))
    ).rejects.toMatchObject({ code: 'INVALID_EXPENSE_STATE' });
  });

  it('más de 80 gastos es 400 y repetidos se rechazan', async () => {
    const ids = Array.from({ length: 81 }, (_, i) => `x${i}`);
    await expect(request(ids)).rejects.toMatchObject({ code: 'TOO_MANY_EXPENSES', status: 400 });
    await expect(request(['a', 'a'])).rejects.toMatchObject({ code: 'INVALID_EXPENSE_STATE' });
  });

  it('el solicitante no puede aprobar su propio reembolso (403)', async () => {
    const e = await legalized(15000);
    const rb = await request([e.id]);
    await expect(
      m.reimbursements.approveReimbursement(
        RID,
        rb.id,
        { source: generalSource(w) },
        metaFor('petty1')
      )
    ).rejects.toMatchObject({ status: 403 });
  });

  it('aprueba desde la general con saldo insuficiente es 409 y no cambia nada', async () => {
    const e = await legalized(30000);
    const rb = await request([e.id]);
    // vacía la caja general
    await m.general.createGeneralMovement(
      RID,
      w.ids.general,
      { type: 'EGRESO', amount: 1000000 - FUND, reason: 'Retiro del dueño' },
      metaFor('acc1')
    );
    await expect(
      m.reimbursements.approveReimbursement(
        RID,
        rb.id,
        { source: generalSource(w) },
        metaFor('boss')
      )
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CASH', status: 409 });
    expect(readPettyState(db, w).reimbursements[0].status).toBe('PENDIENTE_APROBACION');
    assertFundInvariant(db, w);
  });

  it('aprobar: un asiento por gasto (D categoría / C 110510) + reposición, todo cuadrado', async () => {
    const a = await legalized(30000);
    const b = await (async () => {
      const e = await expense(20000, { categoryId: w.categories.transporte });
      await m.expenses.addAttachment(RID, e.id, ATTACHMENT, metaFor('petty1'));
      return m.expenses.legalizeExpense(RID, e.id, metaFor('petty1'));
    })();
    const rb = await request([a.id, b.id]);
    const approved = await m.reimbursements.approveReimbursement(
      RID,
      rb.id,
      { source: generalSource(w) },
      metaFor('boss')
    );
    expect(approved).toMatchObject({ status: 'APROBADO', decidedBy: 'boss' });

    const state = readPettyState(db, w);
    expect(state.expenses.every((x) => x.status === 'REEMBOLSADO')).toBe(true);
    expect(state.expenses.every((x) => x.journalEntryId)).toBe(true);
    expect(state.cashOnHand).toBe(FUND);
    assertFundInvariant(db, w);

    const expenseLines = lines().filter((l) => l.event === 'PETTY_CASH_EXPENSE');
    expect(expenseLines).toHaveLength(4);
    expect(net(w.petty.accAseo)).toBe(30000);
    expect(net(w.petty.accTransporte)).toBe(20000);
    expect(net(w.petty.accPetty)).toBe(FUND);
    expect(net(w.ids.accGeneral)).toBe(1000000 - FUND - 50000);
    const entries = collectionDocs(db, 'journalEntries');
    entries.forEach((en) => expect(en.totalDebit).toBe(en.totalCredit));
    expect(entries.filter((en) => en.event === 'PETTY_CASH_EXPENSE')).toHaveLength(2);
  });

  it('aprobar desde un banco acredita el banco', async () => {
    const a = await legalized(25000);
    const rb = await request([a.id]);
    await m.reimbursements.approveReimbursement(
      RID,
      rb.id,
      { source: { kind: 'BANK', bankAccountId: w.ids.accBank } },
      metaFor('boss')
    );
    expect(net(w.ids.accBank)).toBe(-25000);
    expect(cashOf(w.petty.register)).toBe(FUND);
    assertFundInvariant(db, w);
  });

  it('rechazar libera los gastos para otra solicitud', async () => {
    const e = await legalized(18000);
    const rb = await request([e.id]);
    const rejected = await m.reimbursements.rejectReimbursement(
      RID,
      rb.id,
      'Falta el soporte del proveedor',
      metaFor('boss')
    );
    expect(rejected).toMatchObject({ status: 'RECHAZADO', decisionNote: expect.any(String) });
    expect(readPettyState(db, w).expenses[0]).toMatchObject({
      status: 'LEGALIZADO',
      reimbursementId: null,
    });
    const again = await request([e.id]);
    expect(again.status).toBe('PENDIENTE_APROBACION');
    await expect(
      m.reimbursements.rejectReimbursement(RID, rb.id, 'Segunda vez no', metaFor('boss'))
    ).rejects.toMatchObject({ code: 'INVALID_REIMBURSEMENT_STATE' });
  });

  it('aprobar dos veces con la misma llave es idempotente; con otra llave es 409', async () => {
    const e = await legalized(22000);
    const rb = await request([e.id]);
    const meta = metaFor('boss');
    const input = { source: generalSource(w) };
    const a = await m.reimbursements.approveReimbursement(RID, rb.id, input, meta);
    const b = await m.reimbursements.approveReimbursement(RID, rb.id, input, meta);
    expect(b.replenishMovementId).toBe(a.replenishMovementId);
    await expect(
      m.reimbursements.approveReimbursement(RID, rb.id, input, metaFor('boss'))
    ).rejects.toMatchObject({ code: 'INVALID_REIMBURSEMENT_STATE' });
    expect(cashOf(w.petty.register)).toBe(FUND);
  });

  it('listados y estado del fondo', async () => {
    await legalized(10000);
    await expense(5000);
    const status = await m.status.getPettyStatus(RID, w.petty.register);
    expect(status).toMatchObject({
      fundAmount: FUND,
      constituted: true,
      cashOnHand: FUND - 15000,
      pendingVouchersTotal: 15000,
      invariantOk: true,
      counts: { PENDIENTE: 1, LEGALIZADO: 1, REEMBOLSADO: 0, ANULADO: 0 },
    });
    const list = await m.status.listExpenses(RID, {
      registerId: w.petty.register,
      status: 'LEGALIZADO',
    });
    expect(list).toHaveLength(1);
  });
});

describe('caja menor: validaciones del registro', () => {
  it('exige fondo y gasto máximo coherentes al crear', async () => {
    const { createRegisterSchema } = await import('@/lib/cash/cash.schemas');
    const base = { type: 'MENOR', name: 'Menor 2', ledgerAccountId: w.petty.accPetty };
    expect(createRegisterSchema.safeParse(base).success).toBe(false);
    expect(
      createRegisterSchema.safeParse({ ...base, fundAmount: 100000, maxExpense: 200000 }).success
    ).toBe(false);
    expect(
      createRegisterSchema.safeParse({ ...base, fundAmount: 100000, maxExpense: 50000 }).success
    ).toBe(true);
  });

  it('el gasto máximo se edita sin pasar el fondo y el fondo no se edita directo', async () => {
    const { updateRegisterSchema } = await import('@/lib/cash/cash.schemas');
    expect(updateRegisterSchema.safeParse({ fundAmount: 1 }).success).toBe(false);
    await expect(
      m.registers.updateRegister(RID, w.petty.register, { maxExpense: FUND + 1 }, metaFor('admin'))
    ).rejects.toMatchObject({ code: 'INVALID_FUND' });
    const updated = await m.registers.updateRegister(
      RID,
      w.petty.register,
      { maxExpense: 30000 },
      metaFor('admin')
    );
    expect(updated.maxExpense).toBe(30000);
  });
});
