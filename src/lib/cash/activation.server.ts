// SOLO servidor: activación del módulo de caja (`restaurants/{rid}.cashModuleEnabled`).
// El campo es solo del servidor: las reglas de Firestore impiden que un cliente lo cambie.
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { ledgerCollectionPath } from '@/lib/ledger/ledger.paths';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';
import type { PaymentMethodConfig } from '@/types';

import { computeActivationMissing } from './activation.helpers';
import { CashError } from './cash.errors';
import { cashCollectionPath } from './cash.paths';
import type { CashRegister } from './cash.types';
import { readSettings } from './movement.context.server';

export interface ActivationStatus {
  enabled: boolean;
  missing: string[];
}

async function readStatus(tx: Transaction, restaurantId: string): Promise<ActivationStatus> {
  const [restaurant, accounts, generals, settings] = await Promise.all([
    tx.get(adminDb.doc(`restaurants/${restaurantId}`) as DocumentReference),
    tx.get(adminDb.collection(ledgerCollectionPath(restaurantId, 'accounts')).limit(1)),
    tx.get(
      adminDb
        .collection(cashCollectionPath(restaurantId, 'registers'))
        .where('type', '==', 'GENERAL')
    ),
    readSettings(tx, restaurantId),
  ]);
  const data = restaurant.data() as
    { cashModuleEnabled?: boolean; paymentMethods?: PaymentMethodConfig[] } | undefined;
  const generalRegisterIds = generals.docs
    .filter((d) => (d.data() as CashRegister).isActive)
    .map((d) => d.id);
  return {
    enabled: data?.cashModuleEnabled === true,
    missing: computeActivationMissing({
      hasLedgerAccounts: !accounts.empty,
      generalRegisterIds,
      defaultGeneralRegisterId: settings.defaultGeneralRegisterId,
      paymentMethods: data?.paymentMethods,
      paymentMethodAccounts: settings.paymentMethodAccounts,
    }),
  };
}

export function getActivation(restaurantId: string): Promise<ActivationStatus> {
  return adminDb.runTransaction((tx) => readStatus(tx, restaurantId));
}

export async function setActivation(
  restaurantId: string,
  input: { enabled: boolean },
  meta: MutationMeta
): Promise<ActivationStatus> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<ActivationStatus>(tx, {
      restaurantId,
      scope: 'cash.activation.set',
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const status = await readStatus(tx, restaurantId);
    if (input.enabled && status.missing.length > 0) {
      throw new CashError('ACTIVATION_PREREQUISITES', 'Faltan requisitos para activar la caja', {
        missing: status.missing,
      });
    }
    if (status.enabled !== input.enabled) {
      tx.update(adminDb.doc(`restaurants/${restaurantId}`) as DocumentReference, {
        cashModuleEnabled: input.enabled,
      });
      writeAuditLog(tx, restaurantId, {
        action: input.enabled ? 'cash.module.enabled' : 'cash.module.disabled',
        entityType: 'restaurant',
        entityId: restaurantId,
        context: audit,
      });
    }
    const result: ActivationStatus = { enabled: input.enabled, missing: status.missing };
    idem.save(tx, result);
    return result;
  });
}
