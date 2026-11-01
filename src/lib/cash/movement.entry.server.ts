// SOLO servidor: arma el asiento contable de un movimiento de caja (fase de lectura).
// Un movimiento = un asiento; las cajas no conocen cuentas, solo las reglas contables.
import { resolveAccountRef, resolveRule } from '@/lib/ledger/journal.helpers';
import {
  preparePostEntry,
  prepareReverseEntry,
  type PreparedEntry,
} from '@/lib/ledger/journal.server';
import type { JournalEntryDraft, ResolutionContext } from '@/lib/ledger/ledger.types';

import { CashError } from './cash.errors';
import type { CashMovement } from './cash.types';
import type { MovementContext } from './movement.context.server';
import { MOVEMENT_META, PETTY_FUND_TYPES, TRANSFER_TYPES } from './movement.helpers';
import { preparePettyFundEntry } from './movement.petty.entry.server';

export type MovementForEntry = Pick<
  CashMovement,
  | 'id'
  | 'type'
  | 'direction'
  | 'amount'
  | 'methodType'
  | 'paymentMethodId'
  | 'registerId'
  | 'counterpartRegisterId'
  | 'reason'
>;

export interface EntryOptions {
  accountingDate: string;
  /** Reemplaza la cuenta del débito (p. ej. el supervisor reasigna un faltante). */
  debitAccountOverrideId?: string;
  /** Reemplaza la cuenta del crédito (contrapartida elegida por el contador, p. ej. saldo inicial). */
  creditAccountOverrideId?: string;
  /** Movimiento original cuando esto es un reverso. */
  reverses?: Pick<CashMovement, 'journalEntryId' | 'reason'>;
  /** Motivo del reverso. */
  reversalReason?: string;
}

export interface PreparedMovementEntry {
  entry: PreparedEntry | null;
  skippedReason?: 'SAME_ACCOUNT' | 'RECOGNIZED_ON_REIMBURSEMENT';
}

const describe = (m: MovementForEntry) => `Caja ${m.type}${m.reason ? `: ${m.reason}` : ''}`;

async function transferContext(
  ctx: MovementContext,
  m: MovementForEntry
): Promise<ResolutionContext> {
  if (m.methodType !== 'efectivo') {
    throw new CashError('INVALID_METHOD', 'Los traslados entre cajas son solo en efectivo');
  }
  const counterpartId = m.counterpartRegisterId ?? ctx.settings.defaultGeneralRegisterId;
  if (!counterpartId) {
    throw new CashError('NO_GENERAL_REGISTER', 'Configura la caja general en los ajustes de caja');
  }
  const [own, counterpart] = await Promise.all([
    ctx.registerOf(m.registerId),
    ctx.registerOf(counterpartId),
  ]);
  // La base entra a la caja; retiros y traslados de cierre salen hacia la contraparte
  return m.direction === 'IN'
    ? {
        sourceCashBoxAccountId: counterpart.ledgerAccountId,
        targetCashBoxAccountId: own.ledgerAccountId,
      }
    : {
        sourceCashBoxAccountId: own.ledgerAccountId,
        targetCashBoxAccountId: counterpart.ledgerAccountId,
      };
}

async function methodContext(
  ctx: MovementContext,
  m: MovementForEntry
): Promise<ResolutionContext> {
  const register = await ctx.registerOf(m.registerId);
  const methodAccountId = m.paymentMethodId
    ? ctx.settings.paymentMethodAccounts[m.paymentMethodId]
    : undefined;
  return {
    // El "cajón" de un medio electrónico es la cuenta de ese medio, no el efectivo de la caja
    sourceCashBoxAccountId:
      m.methodType === 'efectivo' ? register.ledgerAccountId : methodAccountId,
    paymentMethodAccountId: methodAccountId,
  };
}

/** Lectura: resuelve regla y cuentas, valida y reserva el consecutivo del asiento. */
export async function prepareEntryForMovement(
  ctx: MovementContext,
  movement: MovementForEntry,
  options: EntryOptions
): Promise<PreparedMovementEntry> {
  const { audit, tx, restaurantId, sequences } = ctx;

  if (movement.type === 'REVERSO') {
    const original = options.reverses?.journalEntryId;
    if (!original) return { entry: null };
    const entry = await prepareReverseEntry(
      tx,
      restaurantId,
      original,
      {
        reason: options.reversalReason ?? 'Reverso de caja',
        accountingDate: options.accountingDate,
      },
      audit,
      sequences
    );
    return { entry };
  }

  // El gasto de caja menor se reconoce al reembolsarse, no cuando sale el efectivo
  if (movement.type === 'GASTO_CAJA_MENOR') {
    return { entry: null, skippedReason: 'RECOGNIZED_ON_REIMBURSEMENT' };
  }
  if (PETTY_FUND_TYPES.includes(movement.type)) {
    return { entry: await preparePettyFundEntry(ctx, movement, options) };
  }

  const event = MOVEMENT_META[movement.type].event;
  if (!event) throw new CashError('INVALID_METHOD', 'El movimiento no genera asiento');

  const isTransfer = TRANSFER_TYPES.includes(movement.type);
  const resolution = isTransfer
    ? await transferContext(ctx, movement)
    : await methodContext(ctx, movement);

  if (isTransfer && resolution.sourceCashBoxAccountId === resolution.targetCashBoxAccountId) {
    return { entry: null, skippedReason: 'SAME_ACCOUNT' };
  }

  const rule = resolveRule(ctx.rules, event, isTransfer ? null : movement.methodType);
  const draft: JournalEntryDraft = {
    accountingDate: options.accountingDate,
    event,
    description: describe(movement),
    sourceType: 'cashMovement',
    sourceId: movement.id,
    ruleId: rule.id,
    ruleVersion: rule.version,
    lines: [
      {
        accountId: options.debitAccountOverrideId ?? resolveAccountRef(rule.debit, resolution),
        debit: movement.amount,
        credit: 0,
      },
      {
        accountId: options.creditAccountOverrideId ?? resolveAccountRef(rule.credit, resolution),
        debit: 0,
        credit: movement.amount,
      },
    ],
  };
  const entry = await preparePostEntry(tx, restaurantId, draft, audit, { sequences });
  return { entry };
}
