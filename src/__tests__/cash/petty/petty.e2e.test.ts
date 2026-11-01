// @vitest-environment node
// Recorrido completo de la caja menor: fondo -> vales -> legalización -> reembolso -> aprobación.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_REIMBURSEMENT_EXPENSES } from '@/lib/cash/petty/petty.helpers';
import type { PettyExpense } from '@/lib/cash/petty/petty.types';

import { FakeFirestore, type FakeTx } from '../../orders/fakeFirestore';
import { collectionDocs, metaFor, RID } from '../cashFixture';

import {
  assertFundInvariant,
  ATTACHMENT,
  expenseInput,
  FUND,
  generalSource,
  loadPettyMods,
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

const lines = () => collectionDocs(db, 'journalLines');
const net = (accountId: string) =>
  lines()
    .filter((l) => l.accountId === accountId)
    .reduce((t, l) => t + (l.debit as number) - (l.credit as number), 0);
const generalCash = () =>
  (
    db.get(`restaurants/${RID}/cashRegisterBalances/${w.ids.general}`) as {
      byMethod: { efectivo: number };
    }
  ).byMethod.efectivo;

describe('integración caja menor', () => {
  it('constituir -> 3 gastos (1 anulado) -> legalizar 2 -> reembolsar -> aprobar', async () => {
    await m.fund.setPettyFund(
      RID,
      w.petty.register,
      { targetAmount: FUND, source: generalSource(w) },
      metaFor('boss')
    );
    const generalBefore = generalCash();
    const create = (amount: number, categoryId: string) =>
      m.expenses.createExpense(RID, expenseInput(w, amount, { categoryId }), metaFor('petty1'));

    const e1 = await create(35000, w.categories.aseo);
    const e2 = await create(18000, w.categories.transporte);
    const e3 = await create(12000, w.categories.aseo);
    assertFundInvariant(db, w);

    await m.expenses.annulExpense(RID, e3.id, 'Registrado por error', metaFor('petty1'));
    assertFundInvariant(db, w);

    for (const e of [e1, e2]) {
      await m.expenses.addAttachment(RID, e.id, ATTACHMENT, metaFor('petty1'));
      await m.expenses.legalizeExpense(RID, e.id, metaFor('petty1'));
    }
    assertFundInvariant(db, w);
    // antes del reembolso el gasto aún no existe contablemente
    expect(lines().filter((l) => l.event === 'PETTY_CASH_EXPENSE')).toHaveLength(0);

    const rb = await m.reimbursements.requestReimbursement(
      RID,
      { registerId: w.petty.register, expenseIds: [e1.id, e2.id] },
      metaFor('petty1')
    );
    expect(rb.total).toBe(53000);
    await m.reimbursements.approveReimbursement(
      RID,
      rb.id,
      { source: generalSource(w) },
      metaFor('boss')
    );

    // Libro: Σ débitos de las cuentas de gasto = total reembolsado
    const expenseDebits = lines()
      .filter((l) => l.event === 'PETTY_CASH_EXPENSE' && l.debit > 0)
      .reduce((t, l) => t + (l.debit as number), 0);
    expect(expenseDebits).toBe(53000);
    expect(net(w.petty.accAseo) + net(w.petty.accTransporte)).toBe(53000);
    // 110510 queda en el fondo y la caja menor vuelve a tener todo el efectivo
    expect(net(w.petty.accPetty)).toBe(FUND);
    expect(readPettyState(db, w).cashOnHand).toBe(FUND);
    // la caja general financió exactamente lo reembolsado
    expect(generalCash()).toBe(generalBefore - 53000);
    assertFundInvariant(db, w);

    const all = collectionDocs(db, 'journalEntries');
    all.forEach((en) => expect(en.totalDebit).toBe(en.totalCredit));
    const debits = lines().reduce((t, l) => t + (l.debit as number), 0);
    const credits = lines().reduce((t, l) => t + (l.credit as number), 0);
    expect(debits).toBe(credits);
  });

  it('un reembolso del tope máximo cabe en el límite de 500 escrituras', async () => {
    await m.fund.setPettyFund(
      RID,
      w.petty.register,
      { targetAmount: FUND, source: generalSource(w) },
      metaFor('boss')
    );
    const count = MAX_REIMBURSEMENT_EXPENSES;
    const ids: string[] = [];
    // 80 vales de $1.000 ya legalizados (se siembran directo: el flujo normal ya está probado)
    for (let i = 0; i < count; i++) {
      const id = `seed-exp-${i}`;
      ids.push(id);
      const doc: PettyExpense = {
        id,
        registerId: w.petty.register,
        voucherNumber: `VCM-9${String(i).padStart(5, '0')}`,
        concept: 'Vale sembrado',
        thirdPartyName: 'Tercero Ficticio',
        categoryId: w.categories.aseo,
        categoryName: 'Aseo',
        ledgerAccountId: w.petty.accAseo,
        amount: 1000,
        date: '2026-03-10',
        attachments: [ATTACHMENT],
        status: 'LEGALIZADO',
        movementId: `seed-mov-${i}`,
        reimbursementId: null,
        createdBy: 'petty1',
        createdAt: '2026-03-10T15:00:00.000Z',
        updatedAt: '2026-03-10T15:00:00.000Z',
      };
      db.set(`restaurants/${RID}/pettyCashExpenses/${id}`, doc as never);
    }
    // el efectivo sale del fondo para que el invariante siga cuadrando
    const balancePath = `restaurants/${RID}/cashRegisterBalances/${w.petty.register}`;
    const balance = db.get(balancePath) as { byMethod: { efectivo: number } };
    db.set(balancePath, {
      ...balance,
      byMethod: { efectivo: balance.byMethod.efectivo - count * 1000 },
    });

    const rb = await m.reimbursements.requestReimbursement(
      RID,
      { registerId: w.petty.register, expenseIds: ids },
      metaFor('petty1')
    );

    let maxWrites = 0;
    const original = db.runTransaction.bind(db);
    vi.spyOn(db, 'runTransaction').mockImplementation(((fn: (tx: FakeTx) => Promise<unknown>) =>
      original(async (tx) => {
        const result = await fn(tx);
        maxWrites = Math.max(maxWrites, tx.writes.length);
        return result;
      })) as never);

    await m.reimbursements.approveReimbursement(
      RID,
      rb.id,
      { source: generalSource(w) },
      metaFor('boss')
    );
    vi.restoreAllMocks();
    expect(maxWrites).toBeGreaterThan(count * 4);
    expect(maxWrites).toBeLessThanOrEqual(500);
    assertFundInvariant(db, w);
  });
});
