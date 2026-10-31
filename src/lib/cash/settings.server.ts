// SOLO servidor: configuración de caja (denominaciones, cuentas por medio de pago, caja general).
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { isPostable } from '@/lib/ledger/accounts.helpers';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { ledgerCollectionPath, stripUndefined } from '@/lib/ledger/ledger.paths';
import type { LedgerAccount } from '@/lib/ledger/ledger.types';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { CashError } from './cash.errors';
import { cashDocPath, SETTINGS_DOC_ID } from './cash.paths';
import type { CashRegister, CashSettings } from './cash.types';
import { defaultSettings, readSettings } from './movement.context.server';

export type UpdateSettingsInput = Pick<
  CashSettings,
  'denominations' | 'paymentMethodAccounts' | 'defaultGeneralRegisterId'
>;

export async function getSettings(restaurantId: string): Promise<CashSettings> {
  return adminDb.runTransaction((tx) => readSettings(tx, restaurantId));
}

function assertDenominations(settings: UpdateSettingsInput) {
  const keys = new Set(settings.denominations.map((d) => d.key));
  if (keys.size !== settings.denominations.length) {
    throw new CashError('INVALID_SETTINGS', 'Hay denominaciones con la misma llave');
  }
}

export async function updateSettings(
  restaurantId: string,
  input: UpdateSettingsInput,
  meta: MutationMeta
): Promise<CashSettings> {
  const { audit } = meta;
  assertDenominations(input);

  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CashSettings>(tx, {
      restaurantId,
      scope: 'cash.settings.update',
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    if (input.defaultGeneralRegisterId) {
      const snap = await tx.get(
        adminDb.doc(
          cashDocPath(restaurantId, 'registers', input.defaultGeneralRegisterId)
        ) as DocumentReference
      );
      const register = snap.data() as CashRegister | undefined;
      if (!register || register.type !== 'GENERAL' || !register.isActive) {
        throw new CashError(
          'INVALID_SETTINGS',
          'La caja general indicada no existe o no es general'
        );
      }
    }
    const accountsCol = ledgerCollectionPath(restaurantId, 'accounts');
    const accountIds = Array.from(new Set(Object.values(input.paymentMethodAccounts)));
    for (const accountId of accountIds) {
      const snap = await tx.get(adminDb.doc(`${accountsCol}/${accountId}`) as DocumentReference);
      const account = snap.data() as LedgerAccount | undefined;
      if (!account || !isPostable(account)) {
        throw new CashError(
          'INVALID_SETTINGS',
          'Una cuenta de medio de pago no existe o no admite movimientos'
        );
      }
    }

    const settings: CashSettings = stripUndefined({
      ...defaultSettings(),
      ...input,
      updatedAt: audit.at,
      updatedBy: audit.uid,
    });
    tx.set(
      adminDb.doc(cashDocPath(restaurantId, 'settings', SETTINGS_DOC_ID)) as DocumentReference,
      settings
    );
    writeAuditLog(tx, restaurantId, {
      action: 'cash.settings.updated',
      entityType: 'cashSettings',
      entityId: SETTINGS_DOC_ID,
      context: audit,
    });
    idem.save(tx, settings);
    return settings;
  });
}
