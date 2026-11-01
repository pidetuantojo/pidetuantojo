// SOLO servidor: reembolsos de la caja menor (legalizar -> aprobar -> reponer el fondo).
// El gasto se reconoce contablemente aquí: un asiento PETTY_CASH_EXPENSE por gasto y un asiento de
// reposición por el total. Todo en una sola transacción (tope de gastos en MAX_REIMBURSEMENT_EXPENSES).
import type { DocumentReference } from 'firebase-admin/firestore';

import { AuthError } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';
import { isPostable } from '@/lib/ledger/accounts.helpers';
import { resolveAccountRef, resolveRule } from '@/lib/ledger/journal.helpers';
import { preparePostEntry, type PreparedEntry } from '@/lib/ledger/journal.server';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import type { JournalEntryDraft } from '@/lib/ledger/ledger.types';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { CashError } from '../cash.errors';
import { readLedgerAccount } from '../general.server';
import { createMovementContext, type MovementContext } from '../movement.context.server';
import { prepareRegisterMovement } from '../movement.server';
import {
  canTransitionExpense,
  canTransitionReimbursement,
  MAX_REIMBURSEMENT_EXPENSES,
  sumExpenses,
} from './petty.helpers';
import { pettyCollectionPath, pettyDocPath } from './petty.paths';
import { readExpense, readReimbursement, requirePettyRegister } from './petty.read.server';
import type { FundSource, PettyExpense, PettyReimbursement } from './petty.types';

const reimbursementRef = (restaurantId: string, id: string) =>
  adminDb.doc(pettyDocPath(restaurantId, 'reimbursements', id)) as DocumentReference;
const expenseRef = (restaurantId: string, id: string) =>
  adminDb.doc(pettyDocPath(restaurantId, 'expenses', id)) as DocumentReference;

export interface RequestReimbursementInput {
  registerId: string;
  expenseIds: string[];
}

export async function requestReimbursement(
  restaurantId: string,
  input: RequestReimbursementInput,
  meta: MutationMeta
): Promise<PettyReimbursement> {
  const { audit } = meta;
  if (input.expenseIds.length > MAX_REIMBURSEMENT_EXPENSES) {
    throw new CashError(
      'TOO_MANY_EXPENSES',
      `Máximo ${MAX_REIMBURSEMENT_EXPENSES} gastos por reembolso`
    );
  }
  if (new Set(input.expenseIds).size !== input.expenseIds.length) {
    throw new CashError('INVALID_EXPENSE_STATE', 'Hay gastos repetidos en la solicitud');
  }
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<PettyReimbursement>(tx, {
      restaurantId,
      scope: `cash.petty.reimbursement.request:${input.registerId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, {
      ...audit,
      registerId: input.registerId,
    });
    await requirePettyRegister(ctx, input.registerId);
    const expenses = await Promise.all(
      input.expenseIds.map((id) => readExpense(tx, restaurantId, id))
    );
    expenses.forEach((e) => {
      if (e.registerId !== input.registerId || e.status !== 'LEGALIZADO' || e.reimbursementId) {
        throw new CashError(
          'INVALID_EXPENSE_STATE',
          'Todos los gastos deben estar legalizados y libres de otro reembolso'
        );
      }
    });

    const ref = adminDb.collection(pettyCollectionPath(restaurantId, 'reimbursements')).doc();
    const reimbursement: PettyReimbursement = {
      id: ref.id,
      registerId: input.registerId,
      expenseIds: input.expenseIds,
      total: sumExpenses(expenses),
      status: 'PENDIENTE_APROBACION',
      requestedBy: audit.uid,
      requestedAt: audit.at,
      audit,
    };
    tx.create(ref as DocumentReference, reimbursement);
    expenses.forEach((e) =>
      tx.update(expenseRef(restaurantId, e.id), { reimbursementId: ref.id, updatedAt: audit.at })
    );
    writeAuditLog(tx, restaurantId, {
      action: 'cash.petty.reimbursement_requested',
      entityType: 'pettyCashReimbursement',
      entityId: ref.id,
      context: { ...audit, registerId: input.registerId },
      data: { total: reimbursement.total, count: expenses.length },
    });
    idem.save(tx, reimbursement);
    return reimbursement;
  });
}

async function readReimbursementExpenses(
  ctx: MovementContext,
  reimbursement: PettyReimbursement
): Promise<PettyExpense[]> {
  const expenses = await Promise.all(
    reimbursement.expenseIds.map((id) => readExpense(ctx.tx, ctx.restaurantId, id))
  );
  expenses.forEach((e) => {
    if (e.status !== 'LEGALIZADO' || e.reimbursementId !== reimbursement.id) {
      throw new CashError('INVALID_EXPENSE_STATE', 'Un gasto del reembolso cambió de estado');
    }
  });
  return expenses;
}

function expenseDraft(
  ctx: MovementContext,
  expense: PettyExpense,
  pettyAccountId: string,
  accountingDate: string
): JournalEntryDraft {
  const rule = resolveRule(ctx.rules, 'PETTY_CASH_EXPENSE', null);
  const resolution = {
    expenseCategoryAccountId: expense.ledgerAccountId,
    sourceCashBoxAccountId: pettyAccountId,
  };
  return {
    accountingDate,
    event: 'PETTY_CASH_EXPENSE',
    description: `Caja menor vale ${expense.voucherNumber}: ${expense.categoryName}`,
    sourceType: 'cashMovement',
    sourceId: expense.movementId,
    ruleId: rule.id,
    ruleVersion: rule.version,
    lines: [
      {
        accountId: resolveAccountRef(rule.debit, resolution),
        debit: expense.amount,
        credit: 0,
      },
      {
        accountId: resolveAccountRef(rule.credit, resolution),
        debit: 0,
        credit: expense.amount,
      },
    ],
  };
}

/** Valida el origen del dinero de la reposición; para la caja general exige efectivo suficiente. */
async function resolveReplenishSource(ctx: MovementContext, source: FundSource, total: number) {
  if (source.kind === 'GENERAL') {
    const general = await ctx.registerOf(source.registerId);
    if (general.type !== 'GENERAL' || !general.isActive) {
      throw new CashError('INVALID_REGISTER', 'El origen debe ser una caja general activa');
    }
    const balance = await ctx.balances.cashOf(general.id);
    if (total > balance) {
      throw new CashError(
        'INSUFFICIENT_CASH',
        `La caja general no tiene efectivo suficiente (saldo: ${balance})`
      );
    }
    return { counterpartRegisterId: general.id };
  }
  const bank = await readLedgerAccount(ctx.tx, ctx.restaurantId, source.bankAccountId);
  if (bank.class !== 'ACTIVO' || !isPostable(bank)) {
    throw new CashError(
      'INVALID_LEDGER_ACCOUNT',
      'La cuenta bancaria debe ser un activo activo que admita movimientos'
    );
  }
  return { bankAccountId: bank.id };
}

export async function approveReimbursement(
  restaurantId: string,
  reimbursementId: string,
  input: { source: FundSource },
  meta: MutationMeta
): Promise<PettyReimbursement> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<PettyReimbursement>(tx, {
      restaurantId,
      scope: `cash.petty.reimbursement.approve:${reimbursementId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const reimbursement = await readReimbursement(tx, restaurantId, reimbursementId);
    if (!canTransitionReimbursement(reimbursement.status, 'APROBADO')) {
      throw new CashError('INVALID_REIMBURSEMENT_STATE', 'El reembolso ya fue resuelto');
    }
    if (reimbursement.requestedBy === audit.uid) {
      throw new AuthError('No puedes aprobar un reembolso que tú mismo solicitaste', 403);
    }
    const registerId = reimbursement.registerId;
    const ctx = await createMovementContext(tx, restaurantId, { ...audit, registerId });
    const pettyRegister = await requirePettyRegister(ctx, registerId);
    const expenses = await readReimbursementExpenses(ctx, reimbursement);
    const resolved = await resolveReplenishSource(ctx, input.source, reimbursement.total);

    // Lecturas: un asiento por gasto + la reposición (las escrituras van al final)
    const entries: PreparedEntry[] = [];
    for (const expense of expenses) {
      entries.push(
        await preparePostEntry(
          tx,
          restaurantId,
          expenseDraft(ctx, expense, pettyRegister.ledgerAccountId, audit.accountingDate),
          ctx.audit,
          { sequences: ctx.sequences }
        )
      );
    }
    const replenish = await prepareRegisterMovement(ctx, {
      type: 'REPOSICION_CAJA_MENOR',
      amount: reimbursement.total,
      methodType: 'efectivo',
      registerId,
      shiftId: null,
      counterpartRegisterId: resolved.counterpartRegisterId,
      bankAccountId: resolved.bankAccountId,
      reason: `Reembolso de ${expenses.length} vales`,
      ...(resolved.bankAccountId ? { creditAccountOverrideId: resolved.bankAccountId } : {}),
    });

    entries.forEach((entry) => entry.commit(tx));
    const movement = replenish.commit(tx);
    expenses.forEach((expense, index) => {
      if (!canTransitionExpense(expense.status, 'REEMBOLSADO')) {
        throw new CashError('INVALID_EXPENSE_STATE', 'Un gasto del reembolso no se puede cerrar');
      }
      tx.update(expenseRef(restaurantId, expense.id), {
        status: 'REEMBOLSADO',
        journalEntryId: entries[index].entryId,
        updatedAt: audit.at,
      });
    });
    const approved: PettyReimbursement = {
      ...reimbursement,
      status: 'APROBADO',
      decidedBy: audit.uid,
      decidedAt: audit.at,
      source: input.source,
      replenishMovementId: movement.id,
    };
    tx.update(reimbursementRef(restaurantId, reimbursementId), {
      status: approved.status,
      decidedBy: approved.decidedBy,
      decidedAt: approved.decidedAt,
      source: approved.source,
      replenishMovementId: approved.replenishMovementId,
    });
    writeAuditLog(tx, restaurantId, {
      action: 'cash.petty.reimbursement_approved',
      entityType: 'pettyCashReimbursement',
      entityId: reimbursementId,
      context: { ...audit, registerId },
      data: { total: reimbursement.total, count: expenses.length, sourceKind: input.source.kind },
    });
    idem.save(tx, approved);
    return approved;
  });
}

/** Rechaza: los gastos siguen legalizados y quedan libres para otra solicitud. */
export async function rejectReimbursement(
  restaurantId: string,
  reimbursementId: string,
  note: string,
  meta: MutationMeta
): Promise<PettyReimbursement> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<PettyReimbursement>(tx, {
      restaurantId,
      scope: `cash.petty.reimbursement.reject:${reimbursementId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: { reimbursementId, note },
    });
    if (idem.status === 'replay') return idem.result;

    const reimbursement = await readReimbursement(tx, restaurantId, reimbursementId);
    if (!canTransitionReimbursement(reimbursement.status, 'RECHAZADO')) {
      throw new CashError('INVALID_REIMBURSEMENT_STATE', 'El reembolso ya fue resuelto');
    }
    const expenses = await Promise.all(
      reimbursement.expenseIds.map((id) => readExpense(tx, restaurantId, id))
    );
    expenses.forEach((e) =>
      tx.update(expenseRef(restaurantId, e.id), { reimbursementId: null, updatedAt: audit.at })
    );
    const rejected: PettyReimbursement = {
      ...reimbursement,
      status: 'RECHAZADO',
      decidedBy: audit.uid,
      decidedAt: audit.at,
      decisionNote: note,
    };
    tx.update(reimbursementRef(restaurantId, reimbursementId), {
      status: rejected.status,
      decidedBy: rejected.decidedBy,
      decidedAt: rejected.decidedAt,
      decisionNote: note,
    });
    writeAuditLog(tx, restaurantId, {
      action: 'cash.petty.reimbursement_rejected',
      entityType: 'pettyCashReimbursement',
      entityId: reimbursementId,
      context: { ...audit, registerId: reimbursement.registerId },
      data: { total: reimbursement.total },
    });
    idem.save(tx, rejected);
    return rejected;
  });
}
