// SOLO servidor: libro diario, libro mayor y balance de comprobación.
import { AggregateField, type DocumentReference, type Query } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { LedgerError } from './ledger.errors';
import { ledgerCollectionPath } from './ledger.paths';
import type { JournalEntry, JournalLine, LedgerAccount } from './ledger.types';
import {
  buildTrialBalance,
  buildTrialBalanceRow,
  closingBalance,
  decodeCursor,
  encodeCursor,
  LEDGER_LINE_CAP,
  withRunningBalance,
} from './reports.helpers';
import type { JournalReport, LedgerReport, TrialBalanceReport } from './reports.types';

interface Sums {
  debit: number;
  credit: number;
}

async function sumQuery(query: Query): Promise<Sums> {
  const snap = await query
    .aggregate({ debit: AggregateField.sum('debit'), credit: AggregateField.sum('credit') })
    .get();
  const data = snap.data();
  return { debit: data.debit ?? 0, credit: data.credit ?? 0 };
}

const linesOf = (restaurantId: string, accountId: string) =>
  adminDb
    .collection(ledgerCollectionPath(restaurantId, 'lines'))
    .where('accountId', '==', accountId);

/** Σ de las líneas de una cuenta antes del inicio del rango y dentro de él (agregaciones). */
async function accountSums(restaurantId: string, accountId: string, from: string, to: string) {
  const base = linesOf(restaurantId, accountId);
  const [before, period] = await Promise.all([
    sumQuery(base.where('accountingDate', '<', from)),
    sumQuery(base.where('accountingDate', '>=', from).where('accountingDate', '<=', to)),
  ]);
  return { before, period };
}

export async function getJournal(
  restaurantId: string,
  input: { from: string; to: string; cursor?: string; limit: number }
): Promise<JournalReport> {
  let query = adminDb
    .collection(ledgerCollectionPath(restaurantId, 'entries'))
    .where('accountingDate', '>=', input.from)
    .where('accountingDate', '<=', input.to)
    .orderBy('accountingDate', 'asc')
    .orderBy('sequence', 'asc');
  if (input.cursor) {
    const [date, sequence] = decodeCursor(input.cursor);
    query = query.startAfter(date, sequence);
  }
  const snap = await query.limit(input.limit + 1).get();
  const docs = snap.docs.slice(0, input.limit);
  const entries = docs.map((d) => ({ ...(d.data() as JournalEntry), id: d.id }));
  const last = entries[entries.length - 1];
  const hasMore = snap.docs.length > input.limit;
  return {
    entries,
    nextCursor: hasMore && last ? encodeCursor(last.accountingDate, last.sequence) : null,
  };
}

async function readAccount(restaurantId: string, accountId: string): Promise<LedgerAccount> {
  const snap = await (
    adminDb.doc(
      `${ledgerCollectionPath(restaurantId, 'accounts')}/${accountId}`
    ) as DocumentReference
  ).get();
  if (!snap.exists) throw new LedgerError('ACCOUNT_NOT_FOUND', 'La cuenta no existe');
  return { ...(snap.data() as LedgerAccount), id: snap.id };
}

export async function getLedger(
  restaurantId: string,
  input: { accountId: string; from: string; to: string }
): Promise<LedgerReport> {
  const account = await readAccount(restaurantId, input.accountId);
  const { before, period } = await accountSums(restaurantId, account.id, input.from, input.to);
  const opening = closingBalance(0, account.nature, before);

  const snap = await linesOf(restaurantId, account.id)
    .where('accountingDate', '>=', input.from)
    .where('accountingDate', '<=', input.to)
    .orderBy('accountingDate', 'asc')
    .orderBy('entryNumber', 'asc')
    .limit(LEDGER_LINE_CAP + 1)
    .get();
  const truncated = snap.docs.length > LEDGER_LINE_CAP;
  const lines = snap.docs
    .slice(0, LEDGER_LINE_CAP)
    .map((d) => ({ ...(d.data() as JournalLine), id: d.id }));

  return {
    account: { id: account.id, code: account.code, name: account.name, nature: account.nature },
    from: input.from,
    to: input.to,
    openingBalance: opening,
    lines: withRunningBalance(opening, account.nature, lines),
    totalDebit: period.debit,
    totalCredit: period.credit,
    closingBalance: closingBalance(opening, account.nature, period),
    truncated,
  };
}

export async function getTrialBalance(
  restaurantId: string,
  input: { from: string; to: string }
): Promise<TrialBalanceReport> {
  const snap = await adminDb.collection(ledgerCollectionPath(restaurantId, 'accounts')).get();
  const accounts = snap.docs
    .map((d) => ({ ...(d.data() as LedgerAccount), id: d.id }))
    .filter((a) => a.allowsMovements);
  const rows = await Promise.all(
    accounts.map(async (account) =>
      buildTrialBalanceRow(
        account,
        await accountSums(restaurantId, account.id, input.from, input.to)
      )
    )
  );
  // Las cuentas sin ningún saldo ni movimiento no aportan al balance
  const active = rows.filter(
    (r) => r.openingNet !== 0 || r.debit !== 0 || r.credit !== 0 || r.closingNet !== 0
  );
  return buildTrialBalance(input, active);
}
