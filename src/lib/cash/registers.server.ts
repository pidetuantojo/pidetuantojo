// SOLO servidor: cajas (registradoras, general, menor). No se borran: se desactivan.
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { isPostable } from '@/lib/ledger/accounts.helpers';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { ledgerCollectionPath, stripUndefined } from '@/lib/ledger/ledger.paths';
import type { LedgerAccount } from '@/lib/ledger/ledger.types';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { CashError } from './cash.errors';
import { cashCollectionPath, cashDocPath, registerLockId } from './cash.paths';
import type { CashRegister, RegisterType } from './cash.types';

export interface CreateRegisterInput {
  type: RegisterType;
  name: string;
  ledgerAccountId: string;
  diffThreshold: number;
  fundAmount?: number;
  maxExpense?: number;
}

export interface UpdateRegisterInput {
  name?: string;
  isActive?: boolean;
  diffThreshold?: number;
  ledgerAccountId?: string;
}

export async function listRegisters(restaurantId: string): Promise<CashRegister[]> {
  const snap = await adminDb.collection(cashCollectionPath(restaurantId, 'registers')).get();
  return snap.docs
    .map((d) => ({ ...(d.data() as CashRegister), id: d.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** La cuenta de efectivo de una caja debe existir, estar activa, admitir movimientos y ser ACTIVO. */
export async function assertCashLedgerAccount(
  tx: Transaction,
  restaurantId: string,
  accountId: string
): Promise<void> {
  const snap = await tx.get(
    adminDb.doc(
      `${ledgerCollectionPath(restaurantId, 'accounts')}/${accountId}`
    ) as DocumentReference
  );
  const account = snap.data() as LedgerAccount | undefined;
  if (!snap.exists || !account || account.class !== 'ACTIVO' || !isPostable(account)) {
    throw new CashError(
      'INVALID_LEDGER_ACCOUNT',
      'La cuenta de la caja debe ser un activo activo que admita movimientos'
    );
  }
}

export async function createRegister(
  restaurantId: string,
  input: CreateRegisterInput,
  meta: MutationMeta
): Promise<CashRegister> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CashRegister>(tx, {
      restaurantId,
      scope: 'cash.register.create',
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    await assertCashLedgerAccount(tx, restaurantId, input.ledgerAccountId);
    const ref = adminDb.collection(cashCollectionPath(restaurantId, 'registers')).doc();
    const register: CashRegister = stripUndefined({
      id: ref.id,
      type: input.type,
      name: input.name,
      isActive: true,
      ledgerAccountId: input.ledgerAccountId,
      diffThreshold: input.diffThreshold,
      fundAmount: input.type === 'MENOR' ? input.fundAmount : undefined,
      maxExpense: input.type === 'MENOR' ? input.maxExpense : undefined,
      createdAt: audit.at,
      updatedAt: audit.at,
    });
    tx.create(ref as DocumentReference, register);
    writeAuditLog(tx, restaurantId, {
      action: 'cash.register.created',
      entityType: 'cashRegister',
      entityId: ref.id,
      context: { ...audit, registerId: ref.id },
      data: { type: register.type },
    });
    idem.save(tx, register);
    return register;
  });
}

export async function updateRegister(
  restaurantId: string,
  registerId: string,
  input: UpdateRegisterInput,
  meta: MutationMeta
): Promise<CashRegister> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CashRegister>(tx, {
      restaurantId,
      scope: `cash.register.update:${registerId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ref = adminDb.doc(
      cashDocPath(restaurantId, 'registers', registerId)
    ) as DocumentReference;
    const snap = await tx.get(ref);
    if (!snap.exists) throw new CashError('REGISTER_NOT_FOUND', 'La caja no existe');
    if (input.ledgerAccountId) {
      const current = snap.data() as CashRegister;
      if (input.ledgerAccountId !== current.ledgerAccountId) {
        // El candado vive mientras el turno no esté CERRADO
        const lock = await tx.get(
          adminDb.doc(
            cashDocPath(restaurantId, 'locks', registerLockId(registerId))
          ) as DocumentReference
        );
        if (lock.exists) {
          throw new CashError(
            'REGISTER_HAS_OPEN_SHIFT',
            'No puedes cambiar la cuenta contable de una caja con turno abierto'
          );
        }
      }
      await assertCashLedgerAccount(tx, restaurantId, input.ledgerAccountId);
    }

    const updated: CashRegister = {
      ...(snap.data() as CashRegister),
      id: registerId,
      ...stripUndefined(input),
      updatedAt: audit.at,
    };
    tx.update(ref, stripUndefined({ ...input, updatedAt: audit.at }));
    writeAuditLog(tx, restaurantId, {
      action: 'cash.register.updated',
      entityType: 'cashRegister',
      entityId: registerId,
      context: { ...audit, registerId },
      data: { fields: Object.keys(input) },
    });
    idem.save(tx, updated);
    return updated;
  });
}
