// SOLO servidor: publicación y reversión de asientos. Diseñado para componerse dentro de la
// transacción de otro caso de uso: primero `prepare*` (lecturas), al final `commit(tx)` (escrituras).
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { writeAuditLog, type AuditContext } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';
import { formatSequence, reserveSequence } from '@/lib/shared/sequence.server';

import {
  buildReversalDraft,
  validateEntry,
  type AccountsById,
  type ValidateOptions,
} from './journal.helpers';
import { LedgerError } from './ledger.errors';
import {
  JOURNAL_PREFIX,
  JOURNAL_SEQUENCE,
  ledgerCollectionPath,
  stripUndefined,
} from './ledger.paths';
import type { JournalEntry, JournalEntryDraft, JournalLine, LedgerAccount } from './ledger.types';

export interface PreparedEntry {
  entryId: string;
  /** Número ya reservado (formateado), disponible antes de escribir. */
  number: string;
  /** Escribe asiento, líneas, consecutivo y auditoría. Solo después de TODAS las lecturas. */
  commit: (tx: Transaction) => JournalEntry;
}

async function loadAccounts(tx: Transaction, restaurantId: string, ids: readonly string[]) {
  const col = ledgerCollectionPath(restaurantId, 'accounts');
  const unique = Array.from(new Set(ids));
  const snaps = await Promise.all(unique.map((id) => tx.get(adminDb.doc(`${col}/${id}`))));
  const map = new Map<string, LedgerAccount>();
  snaps.forEach((s) => {
    if (s.exists) map.set(s.id, { ...(s.data() as LedgerAccount), id: s.id });
  });
  return map as AccountsById;
}

/** Lectura: carga cuentas, valida y reserva el consecutivo `journal`. */
export async function preparePostEntry(
  tx: Transaction,
  restaurantId: string,
  draft: JournalEntryDraft,
  audit: AuditContext,
  options: ValidateOptions = {}
): Promise<PreparedEntry> {
  const accounts = await loadAccounts(
    tx,
    restaurantId,
    draft.lines.map((l) => l.accountId)
  );
  validateEntry(draft, accounts, options);
  const sequence = await reserveSequence(tx, restaurantId, JOURNAL_SEQUENCE);
  const number = formatSequence(JOURNAL_PREFIX, sequence.value);
  const entryRef = adminDb.collection(ledgerCollectionPath(restaurantId, 'entries')).doc();

  const commit = (writeTx: Transaction): JournalEntry => {
    // Última defensa antes de escribir: nunca se persiste un asiento descuadrado
    validateEntry(draft, accounts, options);
    const totalDebit = draft.lines.reduce((t, l) => t + l.debit, 0);
    const totalCredit = draft.lines.reduce((t, l) => t + l.credit, 0);
    const entry: JournalEntry = stripUndefined({
      ...draft,
      lines: draft.lines.map((l) => stripUndefined(l)),
      id: entryRef.id,
      number,
      sequence: sequence.value,
      totalDebit,
      totalCredit,
      audit,
      createdAt: audit.at,
    });
    writeTx.create(entryRef as DocumentReference, entry);

    const linesCol = ledgerCollectionPath(restaurantId, 'lines');
    entry.lines.forEach((line, index) => {
      const account = accounts.get(line.accountId) as LedgerAccount;
      const id = `${entryRef.id}_${index + 1}`;
      const doc: JournalLine = {
        id,
        entryId: entryRef.id,
        entryNumber: number,
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountingDate: draft.accountingDate,
        debit: line.debit,
        credit: line.credit,
        event: draft.event,
        sourceType: draft.sourceType,
        sourceId: draft.sourceId,
        createdAt: audit.at,
      };
      writeTx.create(adminDb.doc(`${linesCol}/${id}`) as DocumentReference, doc);
    });

    sequence.commit(writeTx);
    writeAuditLog(writeTx, restaurantId, {
      action: draft.reversesEntryId ? 'ledger.entry.reversal_posted' : 'ledger.entry.posted',
      entityType: 'journalEntry',
      entityId: entryRef.id,
      context: audit,
      data: { number, event: draft.event, total: totalDebit },
    });
    return entry;
  };

  return { entryId: entryRef.id, number, commit };
}

export interface ReverseMeta {
  reason: string;
  accountingDate: string;
}

/** Lectura: carga el original, arma el contra-asiento y reserva su número. */
export async function prepareReverseEntry(
  tx: Transaction,
  restaurantId: string,
  entryId: string,
  meta: ReverseMeta,
  audit: AuditContext
): Promise<PreparedEntry> {
  const originalRef = adminDb.doc(
    `${ledgerCollectionPath(restaurantId, 'entries')}/${entryId}`
  ) as DocumentReference;
  const snap = await tx.get(originalRef);
  if (!snap.exists) throw new LedgerError('ENTRY_NOT_FOUND', 'El asiento no existe');
  const original = { ...(snap.data() as JournalEntry), id: snap.id };

  const draft = buildReversalDraft(original, meta);
  // Las cuentas pudieron desactivarse después: la reversión igual debe poder asentarse
  const prepared = await preparePostEntry(tx, restaurantId, draft, audit, { allowInactive: true });

  return {
    ...prepared,
    commit: (writeTx) => {
      const entry = prepared.commit(writeTx);
      // Única mutación permitida sobre un asiento publicado
      writeTx.update(originalRef, { reversedByEntryId: entry.id });
      writeAuditLog(writeTx, restaurantId, {
        action: 'ledger.entry.reversed',
        entityType: 'journalEntry',
        entityId: entryId,
        context: { ...audit, reason: meta.reason },
        data: { reversalEntryId: entry.id, number: original.number },
      });
      return entry;
    },
  };
}

/** Caso de uso autónomo: reversión contable hecha por el contador. */
export async function reverseEntry(
  restaurantId: string,
  entryId: string,
  meta: ReverseMeta,
  audit: AuditContext,
  idempotencyKey: string
): Promise<JournalEntry> {
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<JournalEntry>(tx, {
      restaurantId,
      scope: `ledger.entry.reverse:${entryId}`,
      key: idempotencyKey,
      uid: audit.uid,
      payload: { entryId, ...meta },
    });
    if (idem.status === 'replay') return idem.result;

    const prepared = await prepareReverseEntry(tx, restaurantId, entryId, meta, audit);
    const entry = prepared.commit(tx);
    idem.save(tx, entry);
    return entry;
  });
}
