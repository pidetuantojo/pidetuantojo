// SOLO servidor: operaciones de la caja general (sin turno): ingresos/egresos varios, consignaciones
// bancarias y liquidaciones de datáfono. Todas exigen `cash.approve` en la ruta.
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { isPostable } from '@/lib/ledger/accounts.helpers';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { ledgerCollectionPath } from '@/lib/ledger/ledger.paths';
import type { LedgerAccount } from '@/lib/ledger/ledger.types';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { readCashBalance } from './balance.server';
import { CashError } from './cash.errors';
import type { CashMovement } from './cash.types';
import { createMovementContext, type MovementContext } from './movement.context.server';
import { prepareRegisterMovement } from './movement.server';

async function requireGeneralRegister(ctx: MovementContext, registerId: string) {
  const register = await ctx.registerOf(registerId);
  if (register.type !== 'GENERAL' || !register.isActive) {
    throw new CashError('INVALID_REGISTER', 'La operación solo aplica a una caja general activa');
  }
  return register;
}

export async function readLedgerAccount(
  tx: Transaction,
  restaurantId: string,
  accountId: string
): Promise<LedgerAccount> {
  const snap = await tx.get(
    adminDb.doc(
      `${ledgerCollectionPath(restaurantId, 'accounts')}/${accountId}`
    ) as DocumentReference
  );
  if (!snap.exists) {
    throw new CashError('INVALID_LEDGER_ACCOUNT', 'La cuenta contable indicada no existe');
  }
  return { ...(snap.data() as LedgerAccount), id: snap.id };
}

function assertSufficientCash(balance: number, amount: number) {
  if (amount > balance) {
    throw new CashError(
      'INSUFFICIENT_CASH',
      `La caja general no tiene efectivo suficiente (saldo: ${balance})`
    );
  }
}

export interface GeneralMovementInput {
  type: 'INGRESO_VARIO' | 'EGRESO';
  amount: number;
  reason: string;
  externalRef?: string;
  /** Contrapartida elegida por el contador (p. ej. patrimonio para el saldo inicial). */
  accountOverrideId?: string;
}

/** Ingreso o egreso en efectivo de la caja general, sin turno. */
export async function createGeneralMovement(
  restaurantId: string,
  registerId: string,
  input: GeneralMovementInput,
  meta: MutationMeta
): Promise<CashMovement> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CashMovement>(tx, {
      restaurantId,
      scope: `cash.general.movement:${registerId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    await requireGeneralRegister(ctx, registerId);
    if (input.type === 'EGRESO') {
      assertSufficientCash(await readCashBalance(tx, restaurantId, registerId), input.amount);
    }

    const prepared = await prepareRegisterMovement(
      { ...ctx, audit: { ...audit, registerId } },
      {
        type: input.type,
        amount: input.amount,
        methodType: 'efectivo',
        registerId,
        shiftId: null,
        reason: input.reason,
        externalRef: input.externalRef,
        ...(input.accountOverrideId
          ? input.type === 'INGRESO_VARIO'
            ? { creditAccountOverrideId: input.accountOverrideId }
            : { debitAccountOverrideId: input.accountOverrideId }
          : {}),
      }
    );
    const movement = prepared.commit(tx);
    idem.save(tx, movement);
    return movement;
  });
}

export interface DepositInput {
  registerId: string;
  bankAccountId: string;
  amount: number;
  externalRef: string;
}

/** Consignación: el efectivo de la caja general sale hacia una cuenta bancaria (ACTIVO). */
export async function depositToBank(
  restaurantId: string,
  input: DepositInput,
  meta: MutationMeta
): Promise<CashMovement> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<CashMovement>(tx, {
      restaurantId,
      scope: `cash.deposit:${input.registerId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    await requireGeneralRegister(ctx, input.registerId);
    const bank = await readLedgerAccount(tx, restaurantId, input.bankAccountId);
    if (bank.class !== 'ACTIVO' || !isPostable(bank)) {
      throw new CashError(
        'INVALID_LEDGER_ACCOUNT',
        'La cuenta bancaria debe ser un activo activo que admita movimientos'
      );
    }
    assertSufficientCash(await readCashBalance(tx, restaurantId, input.registerId), input.amount);

    const prepared = await prepareRegisterMovement(
      { ...ctx, audit: { ...audit, registerId: input.registerId } },
      {
        type: 'CONSIGNACION',
        amount: input.amount,
        methodType: 'efectivo',
        registerId: input.registerId,
        shiftId: null,
        externalRef: input.externalRef,
        reason: `Consignación ${input.externalRef}`,
        debitAccountOverrideId: bank.id,
        bankAccountId: bank.id,
      }
    );
    const movement = prepared.commit(tx);
    idem.save(tx, movement);
    return movement;
  });
}
