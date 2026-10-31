// SOLO servidor: servicio del plan de cuentas. Nunca se borra: se desactiva.
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { writeAuditLog, type AuditContext } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { assertAccountCode, assertParentConsistent, defaultNature } from './accounts.helpers';
import { LedgerError } from './ledger.errors';
import { ledgerCollectionPath, stripUndefined } from './ledger.paths';
import type {
  AccountClass,
  AccountNature,
  AccountRef,
  AccountingRule,
  LedgerAccount,
} from './ledger.types';

export interface CreateAccountInput {
  code: string;
  name: string;
  class: AccountClass;
  nature?: AccountNature;
  parentCode?: string;
  allowsMovements?: boolean;
  needsAccountantReview?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  isActive?: boolean;
  allowsMovements?: boolean;
  needsAccountantReview?: boolean;
  class?: AccountClass;
  nature?: AccountNature;
}

export interface MutationMeta {
  audit: AuditContext;
  idempotencyKey: string;
}

export async function listAccounts(restaurantId: string): Promise<LedgerAccount[]> {
  const snap = await adminDb.collection(ledgerCollectionPath(restaurantId, 'accounts')).get();
  return snap.docs
    .map((d) => ({ ...(d.data() as LedgerAccount), id: d.id }))
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

const refAccountId = (ref: AccountRef) => (ref.kind === 'fixed' ? ref.accountId : null);

export async function createAccount(
  restaurantId: string,
  input: CreateAccountInput,
  meta: MutationMeta
): Promise<LedgerAccount> {
  const { audit } = meta;
  assertAccountCode(input.code);
  const col = ledgerCollectionPath(restaurantId, 'accounts');

  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<LedgerAccount>(tx, {
      restaurantId,
      scope: 'ledger.account.create',
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const dup = await tx.get(adminDb.collection(col).where('code', '==', input.code).limit(1));
    if (!dup.empty) throw new LedgerError('DUPLICATE_CODE', `Ya existe la cuenta ${input.code}`);
    if (input.parentCode) {
      const parent = await tx.get(
        adminDb.collection(col).where('code', '==', input.parentCode).limit(1)
      );
      assertParentConsistent(
        input.code,
        input.parentCode,
        new Set(parent.empty ? [] : [input.parentCode])
      );
    }

    const ref = adminDb.collection(col).doc();
    const account: LedgerAccount = stripUndefined({
      id: ref.id,
      code: input.code,
      name: input.name,
      class: input.class,
      nature: input.nature ?? defaultNature(input.class),
      parentCode: input.parentCode,
      isActive: true,
      allowsMovements: input.allowsMovements ?? true,
      needsAccountantReview: input.needsAccountantReview ?? true,
      createdAt: audit.at,
      updatedAt: audit.at,
    });
    tx.create(ref as DocumentReference, account);
    writeAuditLog(tx, restaurantId, {
      action: 'ledger.account.created',
      entityType: 'ledgerAccount',
      entityId: ref.id,
      context: audit,
      data: { code: account.code },
    });
    idem.save(tx, account);
    return account;
  });
}

export async function updateAccount(
  restaurantId: string,
  accountId: string,
  patch: UpdateAccountInput,
  meta: MutationMeta
): Promise<LedgerAccount> {
  const { audit } = meta;
  const col = ledgerCollectionPath(restaurantId, 'accounts');

  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<LedgerAccount>(tx, {
      restaurantId,
      scope: `ledger.account.update:${accountId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: patch,
    });
    if (idem.status === 'replay') return idem.result;

    const ref = adminDb.doc(`${col}/${accountId}`) as DocumentReference;
    const snap = await tx.get(ref);
    if (!snap.exists) throw new LedgerError('ACCOUNT_NOT_FOUND', 'La cuenta no existe');
    const current = { ...(snap.data() as LedgerAccount), id: snap.id };

    const changesClassOrNature =
      (patch.class !== undefined && patch.class !== current.class) ||
      (patch.nature !== undefined && patch.nature !== current.nature);
    if (changesClassOrNature) {
      const used = await tx.get(
        adminDb
          .collection(ledgerCollectionPath(restaurantId, 'lines'))
          .where('accountId', '==', accountId)
          .limit(1)
      );
      if (!used.empty) {
        throw new LedgerError(
          'ACCOUNT_IMMUTABLE',
          'La clase y la naturaleza no se pueden cambiar: la cuenta ya tiene movimientos'
        );
      }
    }

    const losesPostability =
      (patch.isActive === false && current.isActive) ||
      (patch.allowsMovements === false && current.allowsMovements);
    if (losesPostability) {
      const rules = await tx.get(
        adminDb
          .collection(ledgerCollectionPath(restaurantId, 'rules'))
          .where('isActive', '==', true)
      );
      const used = rules.docs.some((d) => {
        const rule = d.data() as AccountingRule;
        return refAccountId(rule.debit) === accountId || refAccountId(rule.credit) === accountId;
      });
      if (used) {
        throw new LedgerError(
          'ACCOUNT_USED_BY_RULE',
          `La cuenta ${current.code} está en una regla contable activa`
        );
      }
    }

    const changes = stripUndefined({ ...patch, updatedAt: audit.at });
    const updated: LedgerAccount = { ...current, ...changes };
    tx.update(ref, changes);
    writeAuditLog(tx, restaurantId, {
      action: 'ledger.account.updated',
      entityType: 'ledgerAccount',
      entityId: accountId,
      context: audit,
      data: { code: current.code, fields: Object.keys(patch) },
    });
    idem.save(tx, updated);
    return updated;
  });
}
