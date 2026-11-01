// SOLO servidor: gastos (vales) de la caja menor. El gasto SALE en efectivo al registrarse, pero
// contablemente se reconoce solo al reembolsarse (ver reimbursements.server.ts).
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { stripUndefined } from '@/lib/ledger/ledger.paths';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { CashError } from '../cash.errors';
import { cashDocPath } from '../cash.paths';
import type { CashMovement } from '../cash.types';
import { createMovementContext } from '../movement.context.server';
import { prepareRegisterMovement } from '../movement.server';
import { canTransitionExpense, isExpenseEditable } from './petty.helpers';
import { pettyCollectionPath, pettyDocPath } from './petty.paths';
import { readCategory, readExpense, requirePettyRegister } from './petty.read.server';
import type { PettyAttachment, PettyExpense } from './petty.types';

export const MAX_ATTACHMENTS = 5;

export interface CreateExpenseInput {
  registerId: string;
  concept: string;
  thirdPartyName: string;
  thirdPartyDocument?: string;
  categoryId: string;
  amount: number;
  date: string;
  attachments: PettyAttachment[];
}

const expenseRef = (restaurantId: string, id: string) =>
  adminDb.doc(pettyDocPath(restaurantId, 'expenses', id)) as DocumentReference;

function assertEditable(expense: PettyExpense, action: string) {
  if (!isExpenseEditable(expense)) {
    throw new CashError(
      'INVALID_EXPENSE_STATE',
      `No se puede ${action}: el gasto está ${expense.status.toLowerCase()} o en un reembolso`
    );
  }
}

export async function createExpense(
  restaurantId: string,
  input: CreateExpenseInput,
  meta: MutationMeta
): Promise<PettyExpense> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<PettyExpense>(tx, {
      restaurantId,
      scope: `cash.petty.expense.create:${input.registerId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, {
      ...audit,
      registerId: input.registerId,
    });
    const register = await requirePettyRegister(ctx, input.registerId);
    if (!register.fundConstitutedAt) {
      throw new CashError('FUND_NOT_CONSTITUTED', 'Primero constituye el fondo de la caja menor');
    }
    if (input.amount > (register.maxExpense ?? 0)) {
      throw new CashError(
        'EXPENSE_LIMIT_EXCEEDED',
        `El gasto supera el máximo permitido (${register.maxExpense ?? 0})`
      );
    }
    const category = await readCategory(tx, restaurantId, input.categoryId);
    if (!category.isActive) {
      throw new CashError('PETTY_CATEGORY_NOT_FOUND', 'La categoría está inactiva');
    }
    // Saldo materializado: dos gastos simultáneos no pueden gastar el mismo efectivo
    const cash = await ctx.balances.cashOf(input.registerId);
    if (input.amount > cash) {
      throw new CashError(
        'INSUFFICIENT_CASH',
        `La caja menor no tiene efectivo suficiente (efectivo: ${cash})`
      );
    }

    const prepared = await prepareRegisterMovement(ctx, {
      type: 'GASTO_CAJA_MENOR',
      amount: input.amount,
      methodType: 'efectivo',
      registerId: input.registerId,
      shiftId: null,
      reason: input.concept,
    });
    const movement: CashMovement = prepared.commit(tx);

    const ref = adminDb.collection(pettyCollectionPath(restaurantId, 'expenses')).doc();
    const expense: PettyExpense = stripUndefined({
      id: ref.id,
      registerId: input.registerId,
      voucherNumber: movement.receiptNumber,
      concept: input.concept,
      thirdPartyName: input.thirdPartyName,
      thirdPartyDocument: input.thirdPartyDocument,
      categoryId: category.id,
      categoryName: category.name,
      ledgerAccountId: category.ledgerAccountId,
      amount: input.amount,
      date: input.date,
      attachments: input.attachments,
      status: 'PENDIENTE' as const,
      movementId: movement.id,
      reimbursementId: null,
      createdBy: audit.uid,
      createdAt: audit.at,
      updatedAt: audit.at,
    });
    tx.create(ref as DocumentReference, expense);
    writeAuditLog(tx, restaurantId, {
      action: 'cash.petty.expense_created',
      entityType: 'pettyCashExpense',
      entityId: ref.id,
      context: { ...audit, registerId: input.registerId },
      data: { amount: input.amount, voucherNumber: expense.voucherNumber },
    });
    idem.save(tx, expense);
    return expense;
  });
}

export async function addAttachment(
  restaurantId: string,
  expenseId: string,
  attachment: PettyAttachment,
  meta: MutationMeta
): Promise<PettyExpense> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<PettyExpense>(tx, {
      restaurantId,
      scope: `cash.petty.expense.attach:${expenseId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: attachment,
    });
    if (idem.status === 'replay') return idem.result;

    const expense = await readExpense(tx, restaurantId, expenseId);
    assertEditable(expense, 'adjuntar');
    if (expense.attachments.length >= MAX_ATTACHMENTS) {
      throw new CashError('INVALID_AMOUNT', `Máximo ${MAX_ATTACHMENTS} adjuntos por gasto`);
    }
    const updated: PettyExpense = {
      ...expense,
      attachments: [...expense.attachments, attachment],
      updatedAt: audit.at,
    };
    tx.update(expenseRef(restaurantId, expenseId), {
      attachments: updated.attachments,
      updatedAt: audit.at,
    });
    writeAuditLog(tx, restaurantId, {
      action: 'cash.petty.expense_attached',
      entityType: 'pettyCashExpense',
      entityId: expenseId,
      context: audit,
      data: { attachments: updated.attachments.length },
    });
    idem.save(tx, updated);
    return updated;
  });
}

/** PENDIENTE -> LEGALIZADO: el vale ya tiene soporte (al menos un adjunto). */
export async function legalizeExpense(
  restaurantId: string,
  expenseId: string,
  meta: MutationMeta
): Promise<PettyExpense> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<PettyExpense>(tx, {
      restaurantId,
      scope: `cash.petty.expense.legalize:${expenseId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: { expenseId },
    });
    if (idem.status === 'replay') return idem.result;

    const expense = await readExpense(tx, restaurantId, expenseId);
    if (!canTransitionExpense(expense.status, 'LEGALIZADO')) {
      throw new CashError('INVALID_EXPENSE_STATE', 'Solo se legalizan gastos pendientes');
    }
    if (expense.attachments.length === 0) {
      throw new CashError('ATTACHMENT_REQUIRED', 'Adjunta el soporte antes de legalizar el gasto');
    }
    const updated: PettyExpense = {
      ...expense,
      status: 'LEGALIZADO',
      legalizedAt: audit.at,
      updatedAt: audit.at,
    };
    tx.update(expenseRef(restaurantId, expenseId), {
      status: 'LEGALIZADO',
      legalizedAt: audit.at,
      updatedAt: audit.at,
    });
    writeAuditLog(tx, restaurantId, {
      action: 'cash.petty.expense_legalized',
      entityType: 'pettyCashExpense',
      entityId: expenseId,
      context: { ...audit, registerId: expense.registerId },
      data: { amount: expense.amount },
    });
    idem.save(tx, updated);
    return updated;
  });
}

/** Anula un gasto libre (PENDIENTE/LEGALIZADO sin reembolso) y devuelve el efectivo a la caja. */
export async function annulExpense(
  restaurantId: string,
  expenseId: string,
  reason: string,
  meta: MutationMeta
): Promise<PettyExpense> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<PettyExpense>(tx, {
      restaurantId,
      scope: `cash.petty.expense.annul:${expenseId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: { expenseId, reason },
    });
    if (idem.status === 'replay') return idem.result;

    const expense = await readExpense(tx, restaurantId, expenseId);
    assertEditable(expense, 'anular');
    const movementSnap = await tx.get(
      adminDb.doc(cashDocPath(restaurantId, 'movements', expense.movementId)) as DocumentReference
    );
    if (!movementSnap.exists) {
      throw new CashError('MOVEMENT_NOT_FOUND', 'El movimiento del gasto no existe');
    }
    const original = { ...(movementSnap.data() as CashMovement), id: movementSnap.id };
    if (original.reversedByMovementId) {
      throw new CashError('ALREADY_REVERSED', 'El gasto ya fue reversado');
    }

    const ctx = await createMovementContext(tx, restaurantId, {
      ...audit,
      registerId: expense.registerId,
    });
    const prepared = await prepareRegisterMovement(ctx, {
      type: 'REVERSO',
      amount: original.amount,
      methodType: 'efectivo',
      registerId: expense.registerId,
      shiftId: null,
      reason: `Anulación vale ${expense.voucherNumber}: ${reason}`,
      reverses: original,
    });
    const reversal = prepared.commit(tx);

    const updated: PettyExpense = {
      ...expense,
      status: 'ANULADO',
      reversalMovementId: reversal.id,
      annulReason: reason,
      updatedAt: audit.at,
    };
    tx.update(expenseRef(restaurantId, expenseId), {
      status: 'ANULADO',
      reversalMovementId: reversal.id,
      annulReason: reason,
      updatedAt: audit.at,
    });
    writeAuditLog(tx, restaurantId, {
      action: 'cash.petty.expense_annulled',
      entityType: 'pettyCashExpense',
      entityId: expenseId,
      context: { ...audit, registerId: expense.registerId, reason },
      data: { amount: expense.amount, reversalMovementId: reversal.id },
    });
    idem.save(tx, updated);
    return updated;
  });
}
