// SOLO servidor: constitución y ajuste del fondo fijo de la caja menor.
// Primera llamada: constituye el fondo (fondo vigente 0 -> meta). Luego sube (entra efectivo desde
// el origen) o baja (devuelve la diferencia al origen, solo si hay efectivo en la caja menor).
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { isPostable } from '@/lib/ledger/accounts.helpers';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { CashError } from '../cash.errors';
import { cashDocPath } from '../cash.paths';
import type { CashMovement } from '../cash.types';
import { readLedgerAccount } from '../general.server';
import { createMovementContext, type MovementContext } from '../movement.context.server';
import { prepareRegisterMovement } from '../movement.server';
import { currentFund } from './petty.helpers';
import { readOpenExpenses, requirePettyRegister } from './petty.read.server';
import type { FundSource } from './petty.types';

export interface FundInput {
  targetAmount: number;
  source: FundSource;
}

export interface FundResult {
  registerId: string;
  previousFund: number;
  fundAmount: number;
  movement: CashMovement;
}

interface ResolvedSource {
  counterpartRegisterId?: string;
  bankAccountId?: string;
}

/** Valida el origen/destino del dinero; si es la caja general y sale dinero de ella, exige efectivo. */
async function resolveSource(
  ctx: MovementContext,
  source: FundSource,
  outflowFromSource: number
): Promise<ResolvedSource> {
  if (source.kind === 'GENERAL') {
    const general = await ctx.registerOf(source.registerId);
    if (general.type !== 'GENERAL' || !general.isActive) {
      throw new CashError('INVALID_REGISTER', 'El origen debe ser una caja general activa');
    }
    if (outflowFromSource > 0) {
      const balance = await ctx.balances.cashOf(general.id);
      if (outflowFromSource > balance) {
        throw new CashError(
          'INSUFFICIENT_CASH',
          `La caja general no tiene efectivo suficiente (saldo: ${balance})`
        );
      }
    }
    return { counterpartRegisterId: general.id };
  }
  const bank = await readLedgerAccount(ctx.tx, ctx.restaurantId, source.bankAccountId);
  if (bank.class !== 'ACTIVO' || !isPostable(bank)) {
    throw new CashError(
      'INVALID_LEDGER_ACCOUNT',
      'La cuenta bancaria debe ser un activo activo que admita movimientos'
    );
  }
  return { bankAccountId: bank.id };
}

export async function setPettyFund(
  restaurantId: string,
  registerId: string,
  input: FundInput,
  meta: MutationMeta
): Promise<FundResult> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<FundResult>(tx, {
      restaurantId,
      scope: `cash.petty.fund:${registerId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, { ...audit, registerId });
    const register = await requirePettyRegister(ctx, registerId);
    if ((register.maxExpense ?? 0) > input.targetAmount) {
      throw new CashError('INVALID_FUND', 'El fondo no puede ser menor al gasto máximo permitido');
    }
    const cash = await ctx.balances.cashOf(registerId);
    const open = await readOpenExpenses(tx, restaurantId, registerId);
    const previousFund = currentFund(cash, open);
    const delta = input.targetAmount - previousFund;
    if (delta === 0) throw new CashError('INVALID_FUND', 'El fondo ya tiene ese valor');
    if (delta < 0 && -delta > cash) {
      throw new CashError(
        'INSUFFICIENT_CASH',
        `Solo hay ${cash} en efectivo en la caja menor: faltan vales por reembolsar`
      );
    }
    const resolved = await resolveSource(ctx, input.source, delta > 0 ? delta : 0);

    const inbound = delta > 0;
    const prepared = await prepareRegisterMovement(ctx, {
      type: inbound ? 'REPOSICION_CAJA_MENOR' : 'DEVOLUCION_FONDO',
      amount: Math.abs(delta),
      methodType: 'efectivo',
      registerId,
      shiftId: null,
      counterpartRegisterId: resolved.counterpartRegisterId,
      bankAccountId: resolved.bankAccountId,
      reason: previousFund === 0 ? 'Constitución del fondo' : 'Ajuste del fondo',
      ...(resolved.bankAccountId
        ? inbound
          ? { creditAccountOverrideId: resolved.bankAccountId }
          : { debitAccountOverrideId: resolved.bankAccountId }
        : {}),
    });
    const movement = prepared.commit(tx);
    tx.update(
      adminDb.doc(cashDocPath(restaurantId, 'registers', registerId)) as DocumentReference,
      {
        fundAmount: input.targetAmount,
        fundConstitutedAt: register.fundConstitutedAt ?? audit.at,
        updatedAt: audit.at,
      }
    );
    writeAuditLog(tx, restaurantId, {
      action: 'cash.petty.fund_set',
      entityType: 'cashRegister',
      entityId: registerId,
      context: { ...audit, registerId },
      data: { previousFund, fundAmount: input.targetAmount, movementId: movement.id },
    });
    const result: FundResult = {
      registerId,
      previousFund,
      fundAmount: input.targetAmount,
      movement,
    };
    idem.save(tx, result);
    return result;
  });
}
