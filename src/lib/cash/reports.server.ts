// SOLO servidor: reportes de caja (cierre por turno, resumen diario y estado de caja menor).
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { ledgerCollectionPath } from '@/lib/ledger/ledger.paths';
import type { JournalEntry } from '@/lib/ledger/ledger.types';
import { accountingDayRangeUtc } from '@/lib/shared/bogotaDate';

import { CashError } from './cash.errors';
import { cashCollectionPath, cashDocPath } from './cash.paths';
import type { CashClosing, CashMovement, CashRegister, CashShift } from './cash.types';
import { pettyCollectionPath } from './petty/petty.paths';
import { getPettyStatus } from './petty/status.server';
import type { PettyExpense, PettyReimbursement } from './petty/petty.types';
import { omitAudit } from './api.server';
import { buildDailySummary, groupExpenses } from './reports.helpers';
import type { DailySummary, PettyReport, ShiftReport } from './reports.types';

const docOf = (path: string) => adminDb.doc(path) as DocumentReference;

export async function listRegistersLite(restaurantId: string) {
  const snap = await adminDb.collection(cashCollectionPath(restaurantId, 'registers')).get();
  return snap.docs.map((d) => ({ ...(d.data() as CashRegister), id: d.id }));
}

async function journalNumbers(restaurantId: string, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const col = ledgerCollectionPath(restaurantId, 'entries');
  const snaps = await adminDb.getAll(...ids.map((id) => docOf(`${col}/${id}`)));
  return snaps
    .filter((s) => s.exists)
    .map((s) => (s.data() as JournalEntry).number)
    .sort();
}

export async function getShiftReport(restaurantId: string, shiftId: string): Promise<ShiftReport> {
  const shiftSnap = await docOf(cashDocPath(restaurantId, 'shifts', shiftId)).get();
  if (!shiftSnap.exists) throw new CashError('SHIFT_NOT_FOUND', 'El turno no existe');
  const shift = { ...(shiftSnap.data() as CashShift), id: shiftSnap.id };

  const [registerSnap, closingSnap, movementsSnap] = await Promise.all([
    docOf(cashDocPath(restaurantId, 'registers', shift.registerId)).get(),
    shift.closingId
      ? docOf(cashDocPath(restaurantId, 'closings', shift.closingId)).get()
      : Promise.resolve(null),
    adminDb
      .collection(cashCollectionPath(restaurantId, 'movements'))
      .where('shiftId', '==', shiftId)
      .get(),
  ]);

  const register = registerSnap.exists ? (registerSnap.data() as CashRegister) : null;
  const closing =
    closingSnap && closingSnap.exists
      ? { ...(closingSnap.data() as CashClosing), id: closingSnap.id }
      : null;
  const movements = movementsSnap.docs
    .map((d) => ({ ...(d.data() as CashMovement), id: d.id }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const entryIds = Array.from(
    new Set(movements.map((m) => m.journalEntryId).filter((id): id is string => Boolean(id)))
  );
  const { approval, ...closingSnapshot } = closing ?? ({} as Partial<CashClosing>);

  return {
    shift: omitAudit(shift),
    register: register ? { id: shift.registerId, name: register.name, type: register.type } : null,
    cashierUid: shift.cashierUid,
    openingCount: shift.openingCount,
    openingTotal: shift.openingTotal,
    movements: movements.map(omitAudit),
    closing: closing ? (closingSnapshot as Omit<CashClosing, 'approval'>) : null,
    approval: approval ?? null,
    journalEntryNumbers: await journalNumbers(restaurantId, entryIds),
  };
}

export async function getDailySummary(restaurantId: string, date: string): Promise<DailySummary> {
  const [registers, movementsSnap] = await Promise.all([
    listRegistersLite(restaurantId),
    adminDb
      .collection(cashCollectionPath(restaurantId, 'movements'))
      .where('accountingDate', '==', date)
      .where('status', '==', 'APLICADO')
      .get(),
  ]);
  const movements = movementsSnap.docs.map((d) => d.data() as CashMovement);
  return buildDailySummary(date, registers, movements);
}

export async function getPettyReport(
  restaurantId: string,
  input: { registerId: string; from: string; to: string }
): Promise<PettyReport> {
  const [status, registerSnap] = await Promise.all([
    getPettyStatus(restaurantId, input.registerId),
    docOf(cashDocPath(restaurantId, 'registers', input.registerId)).get(),
  ]);
  const register = registerSnap.data() as CashRegister;
  const { startIso } = accountingDayRangeUtc(input.from);
  const { endIso } = accountingDayRangeUtc(input.to);

  const [expensesSnap, reimbursementsSnap] = await Promise.all([
    adminDb
      .collection(pettyCollectionPath(restaurantId, 'expenses'))
      .where('registerId', '==', input.registerId)
      .where('date', '>=', input.from)
      .where('date', '<=', input.to)
      .get(),
    adminDb
      .collection(pettyCollectionPath(restaurantId, 'reimbursements'))
      .where('registerId', '==', input.registerId)
      .where('requestedAt', '>=', startIso)
      .where('requestedAt', '<', endIso)
      .get(),
  ]);
  const expenses = expensesSnap.docs.map((d) => d.data() as PettyExpense);
  const groups = groupExpenses(expenses);
  const reimbursements = reimbursementsSnap.docs
    .map((d) => ({ ...(d.data() as PettyReimbursement), id: d.id }))
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));

  return {
    registerId: input.registerId,
    registerName: register.name,
    from: input.from,
    to: input.to,
    status,
    expensesByCategory: groups,
    expensesTotal: groups.reduce((t, g) => t + g.total, 0),
    expenseCount: expenses.length,
    reimbursements: reimbursements.map(omitAudit),
    reimbursedTotal: reimbursements
      .filter((r) => r.status === 'APROBADO')
      .reduce((t, r) => t + r.total, 0),
  };
}
