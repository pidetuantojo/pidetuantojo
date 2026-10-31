// SOLO servidor: caso de uso interno y genérico para registrar un movimiento de caja.
// Lo usan los endpoints de caja (fase 2a) y los pagos de pedidos (fase 2b).
// Patrón de transacción: `prepareRegisterMovement` SOLO lee; `commit(tx)` escribe al final.
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { stripUndefined } from '@/lib/ledger/ledger.paths';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { assertMoney, MoneyError, type Money } from '@/lib/shared/money';
import { formatSequence } from '@/lib/shared/sequence.server';
import type { PaymentMethodType } from '@/types';

import { CashError } from './cash.errors';
import { cashCollectionPath, cashDocPath, MOVEMENT_SEQUENCES } from './cash.paths';
import type { CashMovement, MovementStatus, MovementType } from './cash.types';
import type { MovementContext } from './movement.context.server';
import { prepareEntryForMovement } from './movement.entry.server';
import { MOVEMENT_META, oppositeDirection } from './movement.helpers';

export interface RegisterMovementInput {
  type: MovementType;
  /** Entero positivo en pesos. */
  amount: Money;
  methodType: PaymentMethodType;
  /** id del `PaymentMethodConfig` del restaurante (medios electrónicos). */
  paymentMethodId?: string;
  registerId: string;
  /** null = movimiento sin turno (cajas general/menor). */
  shiftId: string | null;
  counterpartRegisterId?: string;
  orderId?: string;
  externalRef?: string;
  reason?: string;
  /** Por defecto APLICADO. PENDIENTE_APROBACION no genera asiento ni cuenta en el esperado. */
  status?: Extract<MovementStatus, 'APLICADO' | 'PENDIENTE_APROBACION'>;
  /** Por defecto, el día de Bogotá del evento (`audit.accountingDate`). */
  accountingDate?: string;
  /** Reasigna la cuenta del débito del asiento (faltante aprobado por el supervisor). */
  debitAccountOverrideId?: string;
  /** Solo REVERSO: el movimiento que se anula. */
  reverses?: CashMovement;
}

export interface PreparedMovement {
  /** Documento completo, ya con id, comprobante y asiento reservados (aún sin escribir). */
  movement: CashMovement;
  /** Escribe movimiento, asiento, consecutivos y auditoría. Solo tras TODAS las lecturas. */
  commit: (tx: Transaction) => CashMovement;
}

function assertAmount(amount: number): void {
  try {
    assertMoney(amount, { allowZero: false });
  } catch (error) {
    if (error instanceof MoneyError) throw new CashError('INVALID_AMOUNT', error.message);
    throw error;
  }
}

async function assertPaymentMethod(ctx: MovementContext, input: RegisterMovementInput) {
  if (input.methodType === 'efectivo' || !input.paymentMethodId) return;
  const methods = await ctx.paymentMethods();
  const found = methods.find((m) => m.id === input.paymentMethodId);
  if (!found || found.type !== input.methodType) {
    throw new CashError('INVALID_METHOD', 'El medio de pago no coincide con los del restaurante');
  }
}

/** Lectura: valida caja y turno, reserva comprobante y asiento. */
export async function prepareRegisterMovement(
  ctx: MovementContext,
  input: RegisterMovementInput
): Promise<PreparedMovement> {
  const { audit, restaurantId } = ctx;
  const meta = MOVEMENT_META[input.type];
  assertAmount(input.amount);

  const register = await ctx.registerOf(input.registerId);
  if (!register.isActive) throw new CashError('INVALID_REGISTER', 'La caja está inactiva');
  await assertPaymentMethod(ctx, input);

  let cashierUid = audit.uid;
  if (input.shiftId) {
    const shift = await ctx.shiftOf(input.shiftId);
    if (shift.registerId !== input.registerId) {
      throw new CashError('INVALID_SHIFT_STATE', 'El turno no pertenece a esa caja');
    }
    if (!meta.shiftStatuses.includes(shift.status)) {
      throw new CashError(
        'INVALID_SHIFT_STATE',
        `El turno está ${shift.status} y no admite este movimiento`
      );
    }
    cashierUid = shift.cashierUid;
  }

  const direction = meta.direction ?? oppositeDirection(input.reverses?.direction ?? 'IN');
  if (input.type === 'REVERSO' && !input.reverses) {
    throw new CashError('NOT_REVERSIBLE', 'Falta el movimiento a reversar');
  }

  const status = input.status ?? 'APLICADO';
  const accountingDate = input.accountingDate ?? audit.accountingDate;
  const movementRef = adminDb.collection(cashCollectionPath(restaurantId, 'movements')).doc();
  const sequence = await ctx.sequences.reserve(MOVEMENT_SEQUENCES[meta.family]);

  const draft = {
    id: movementRef.id,
    type: input.type,
    direction,
    amount: input.amount,
    methodType: input.methodType,
    paymentMethodId: input.paymentMethodId,
    registerId: input.registerId,
    counterpartRegisterId: input.counterpartRegisterId,
    reason: input.reason,
  };
  const prepared =
    status === 'APLICADO'
      ? await prepareEntryForMovement(ctx, draft, {
          accountingDate,
          debitAccountOverrideId: input.debitAccountOverrideId,
          reverses: input.reverses,
          reversalReason: input.reason,
        })
      : { entry: null };

  const movement: CashMovement = stripUndefined({
    ...draft,
    shiftId: input.shiftId,
    cashierUid,
    orderId: input.orderId,
    externalRef: input.externalRef,
    reversesMovementId: input.reverses?.id,
    status,
    receiptNumber: formatSequence(meta.family, sequence.value),
    accountingDate,
    journalEntryId: prepared.entry?.entryId ?? null,
    journalSkippedReason: 'skippedReason' in prepared ? prepared.skippedReason : undefined,
    audit,
    createdAt: audit.at,
  });

  const commit = (tx: Transaction): CashMovement => {
    prepared.entry?.commit(tx);
    tx.create(movementRef as DocumentReference, movement);
    sequence.commit(tx);
    if (input.reverses) {
      tx.update(
        adminDb.doc(cashDocPath(restaurantId, 'movements', input.reverses.id)) as DocumentReference,
        { reversedByMovementId: movement.id }
      );
    }
    writeAuditLog(tx, restaurantId, {
      action: `cash.movement.${input.type.toLowerCase()}`,
      entityType: 'cashMovement',
      entityId: movement.id,
      context: audit,
      data: {
        amount: movement.amount,
        direction,
        status,
        receiptNumber: movement.receiptNumber,
        registerId: movement.registerId,
        shiftId: movement.shiftId,
      },
    });
    return movement;
  };

  return { movement, commit };
}
