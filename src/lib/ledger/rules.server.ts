// SOLO servidor: servicio de reglas contables. Una regla nunca se edita: se versiona.
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';
import type { PaymentMethodType } from '@/types';

import type { MutationMeta } from './accounts.server';
import { isPostable } from './accounts.helpers';
import { LedgerError } from './ledger.errors';
import { ledgerCollectionPath } from './ledger.paths';
import type { AccountingEvent, AccountingRule, AccountRef, LedgerAccount } from './ledger.types';

export interface CreateRuleInput {
  event: AccountingEvent;
  methodType: PaymentMethodType | null;
  debit: AccountRef;
  credit: AccountRef;
}

export type UpdateRuleInput = Pick<CreateRuleInput, 'debit' | 'credit'>;

export async function listRules(restaurantId: string): Promise<AccountingRule[]> {
  const snap = await adminDb.collection(ledgerCollectionPath(restaurantId, 'rules')).get();
  return snap.docs.map((d) => ({ ...(d.data() as AccountingRule), id: d.id }));
}

/** Las cuentas fijas deben existir, estar activas y admitir movimientos. */
async function assertFixedAccountsPostable(
  tx: Transaction,
  restaurantId: string,
  refs: readonly AccountRef[]
): Promise<void> {
  const col = ledgerCollectionPath(restaurantId, 'accounts');
  const ids = Array.from(new Set(refs.flatMap((r) => (r.kind === 'fixed' ? [r.accountId] : []))));
  const snaps = await Promise.all(ids.map((id) => tx.get(adminDb.doc(`${col}/${id}`))));
  snaps.forEach((snap, i) => {
    if (!snap.exists) throw new LedgerError('ACCOUNT_NOT_FOUND', `La cuenta ${ids[i]} no existe`);
    const account = snap.data() as LedgerAccount;
    if (!account.isActive)
      throw new LedgerError('ACCOUNT_INACTIVE', `La cuenta ${account.code} está inactiva`);
    if (!isPostable(account)) {
      throw new LedgerError(
        'ACCOUNT_NOT_POSTABLE',
        `La cuenta ${account.code} no admite movimientos`
      );
    }
  });
}

async function rulesOfEvent(tx: Transaction, restaurantId: string, event: AccountingEvent) {
  const snap = await tx.get(
    adminDb.collection(ledgerCollectionPath(restaurantId, 'rules')).where('event', '==', event)
  );
  return snap.docs.map((d) => ({ ...(d.data() as AccountingRule), id: d.id }));
}

export async function createRule(
  restaurantId: string,
  input: CreateRuleInput,
  meta: MutationMeta
): Promise<AccountingRule> {
  const { audit } = meta;
  const col = ledgerCollectionPath(restaurantId, 'rules');

  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<AccountingRule>(tx, {
      restaurantId,
      scope: 'ledger.rule.create',
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    await assertFixedAccountsPostable(tx, restaurantId, [input.debit, input.credit]);
    const sameEvent = (await rulesOfEvent(tx, restaurantId, input.event)).filter(
      (r) => r.methodType === input.methodType
    );
    if (sameEvent.some((r) => r.isActive)) {
      throw new LedgerError(
        'DUPLICATE_RULE',
        'Ya hay una regla activa para este evento y medio de pago; edítala para crear una nueva versión'
      );
    }

    const ref = adminDb.collection(col).doc();
    const rule: AccountingRule = {
      id: ref.id,
      event: input.event,
      methodType: input.methodType,
      debit: input.debit,
      credit: input.credit,
      version: sameEvent.reduce((max, r) => Math.max(max, r.version), 0) + 1,
      isActive: true,
      createdAt: audit.at,
      createdBy: audit.uid,
    };
    tx.create(ref as DocumentReference, rule);
    writeAuditLog(tx, restaurantId, {
      action: 'ledger.rule.created',
      entityType: 'accountingRule',
      entityId: ref.id,
      context: audit,
      data: { event: rule.event, methodType: rule.methodType, version: rule.version },
    });
    idem.save(tx, rule);
    return rule;
  });
}

/** "Editar" = crear la versión N+1 y marcar la anterior como reemplazada. Los asientos viejos conservan su ruleVersion. */
export async function updateRule(
  restaurantId: string,
  ruleId: string,
  input: UpdateRuleInput,
  meta: MutationMeta
): Promise<AccountingRule> {
  const { audit } = meta;
  const col = ledgerCollectionPath(restaurantId, 'rules');

  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<AccountingRule>(tx, {
      restaurantId,
      scope: `ledger.rule.update:${ruleId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const oldRef = adminDb.doc(`${col}/${ruleId}`) as DocumentReference;
    const snap = await tx.get(oldRef);
    if (!snap.exists) throw new LedgerError('RULE_NOT_FOUND', 'La regla no existe');
    const old = { ...(snap.data() as AccountingRule), id: snap.id };
    if (!old.isActive)
      throw new LedgerError('RULE_INACTIVE', 'Solo se puede editar la versión activa de la regla');

    await assertFixedAccountsPostable(tx, restaurantId, [input.debit, input.credit]);
    const versions = await rulesOfEvent(tx, restaurantId, old.event);
    const maxVersion = versions
      .filter((r) => r.methodType === old.methodType)
      .reduce((max, r) => Math.max(max, r.version), old.version);

    const newRef = adminDb.collection(col).doc();
    const next: AccountingRule = {
      id: newRef.id,
      event: old.event,
      methodType: old.methodType,
      debit: input.debit,
      credit: input.credit,
      version: maxVersion + 1,
      isActive: true,
      createdAt: audit.at,
      createdBy: audit.uid,
    };
    tx.create(newRef as DocumentReference, next);
    tx.update(oldRef, { isActive: false, supersededAt: audit.at, supersededBy: newRef.id });
    writeAuditLog(tx, restaurantId, {
      action: 'ledger.rule.versioned',
      entityType: 'accountingRule',
      entityId: newRef.id,
      context: audit,
      data: { previousRuleId: ruleId, event: next.event, version: next.version },
    });
    idem.save(tx, next);
    return next;
  });
}

export async function deactivateRule(
  restaurantId: string,
  ruleId: string,
  meta: MutationMeta
): Promise<AccountingRule> {
  const { audit } = meta;
  const col = ledgerCollectionPath(restaurantId, 'rules');

  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<AccountingRule>(tx, {
      restaurantId,
      scope: `ledger.rule.deactivate:${ruleId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: { ruleId },
    });
    if (idem.status === 'replay') return idem.result;

    const ref = adminDb.doc(`${col}/${ruleId}`) as DocumentReference;
    const snap = await tx.get(ref);
    if (!snap.exists) throw new LedgerError('RULE_NOT_FOUND', 'La regla no existe');
    const rule = { ...(snap.data() as AccountingRule), id: snap.id };
    if (!rule.isActive) throw new LedgerError('RULE_INACTIVE', 'La regla ya está inactiva');

    tx.update(ref, { isActive: false });
    writeAuditLog(tx, restaurantId, {
      action: 'ledger.rule.deactivated',
      entityType: 'accountingRule',
      entityId: ruleId,
      context: audit,
      data: { event: rule.event, version: rule.version },
    });
    const result = { ...rule, isActive: false };
    idem.save(tx, result);
    return result;
  });
}
