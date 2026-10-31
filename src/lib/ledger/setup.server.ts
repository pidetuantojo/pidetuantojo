// SOLO servidor: siembra el plan de cuentas y las reglas por defecto de un restaurante (idempotente).
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { writeAuditLog, type AuditContext } from '@/lib/shared/audit.server';

import { ledgerCollectionPath } from './ledger.paths';
import { buildSeedDocs } from './seed.helpers';

export interface SetupResult {
  created: boolean;
  accounts: number;
  rules: number;
}

export async function setupLedger(restaurantId: string, audit: AuditContext): Promise<SetupResult> {
  const accountsCol = ledgerCollectionPath(restaurantId, 'accounts');
  const rulesCol = ledgerCollectionPath(restaurantId, 'rules');

  return adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(adminDb.collection(accountsCol).limit(1));
    if (!existing.empty) return { created: false, accounts: 0, rules: 0 };

    const seed = buildSeedDocs({
      newId: () => adminDb.collection(accountsCol).doc().id,
      now: audit.at,
      createdBy: audit.uid,
    });
    // 11 cuentas + 22 reglas + auditoría: muy por debajo del límite de 500 escrituras
    seed.accounts.forEach((a) => tx.create(adminDb.doc(`${accountsCol}/${a.id}`) as DocumentReference, a));
    seed.rules.forEach((r) => tx.create(adminDb.doc(`${rulesCol}/${r.id}`) as DocumentReference, r));
    writeAuditLog(tx, restaurantId, {
      action: 'ledger.setup',
      entityType: 'ledger',
      entityId: restaurantId,
      context: audit,
      data: { accounts: seed.accounts.length, rules: seed.rules.length },
    });
    return { created: true, accounts: seed.accounts.length, rules: seed.rules.length };
  });
}
