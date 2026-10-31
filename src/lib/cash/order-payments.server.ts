// SOLO servidor: cobro y reverso de pagos de pedidos a través de caja.
// Cada pago es un movimiento VENTA (un asiento); el pedido guarda el pago con el id del movimiento.
import { createPaymentId, isFullyPaid } from '@/features/orders/helpers/payments.helpers';
import { getPaymentLabel } from '@/features/payment-methods/helpers/payment-methods.helpers';
import { adminDb } from '@/lib/firebase/admin';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { stripUndefined } from '@/lib/ledger/ledger.paths';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';
import type { OrderPayment } from '@/types';

import { CashError } from './cash.errors';
import { cashDocPath } from './cash.paths';
import type { CashMovement } from './cash.types';
import { createMovementContext } from './movement.context.server';
import { assertReversible } from './movement.helpers';
import { prepareRegisterMovement, type PreparedMovement } from './movement.server';
import {
  assertOrderPayable,
  assertReceived,
  assertWithinTotal,
  computeChange,
  markPaymentReversed,
  resolvePaymentMethod,
  type PaymentRequest,
} from './order-payments.helpers';
import { loadOrder } from './order-payments.load.server';
import { resolveOpenShift, resolveTarget } from './shift.resolve.server';

export interface PayOrderInput {
  orderId: string;
  payments: (PaymentRequest & { label?: string; externalRef?: string })[];
}

export interface OrderPaymentResult {
  orderId: string;
  isPaid: boolean;
  payments: OrderPayment[];
  /** Cambio informativo (recibido − monto) si algún pago en efectivo trae `received`. */
  change?: number;
}

export async function payOrder(
  restaurantId: string,
  input: PayOrderInput,
  meta: MutationMeta
): Promise<OrderPaymentResult> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<OrderPaymentResult>(tx, {
      restaurantId,
      scope: `cash.order_payment.pay:${input.orderId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    const { ref, order, statusCode, restaurant } = await loadOrder(ctx, input.orderId);
    assertOrderPayable(order, statusCode);
    const shift = await resolveOpenShift(ctx, audit.uid);

    const resolved = input.payments.map((p) => {
      const method = resolvePaymentMethod(restaurant, order, p.paymentMethodId);
      assertReceived(method, p);
      return { request: p, method };
    });
    assertWithinTotal(
      order,
      input.payments.map((p) => p.amount)
    );

    const created: OrderPayment[] = [];
    const prepared: PreparedMovement[] = [];
    for (const { request, method } of resolved) {
      const target = resolveTarget(ctx, method.type, shift);
      const movement = await prepareRegisterMovement(
        {
          ...ctx,
          audit: {
            ...audit,
            registerId: target.registerId,
            shiftId: target.shiftId ?? undefined,
            orderId: order.id,
          },
        },
        {
          type: 'VENTA',
          amount: request.amount,
          methodType: method.type,
          paymentMethodId: method.id,
          ...target,
          orderId: order.id,
          externalRef: request.externalRef,
        }
      );
      prepared.push(movement);
      created.push(
        stripUndefined({
          id: createPaymentId(),
          amount: request.amount,
          method: getPaymentLabel(method),
          methodType: method.type,
          paymentMethodId: method.id,
          account: method.account,
          label: request.label,
          received: request.received,
          paidAt: audit.at,
          paidBy: audit.uid,
          movementId: movement.movement.id,
        })
      );
    }

    const payments = [...(order.payments ?? []), ...created];
    const isPaid = isFullyPaid({ ...order, payments });
    prepared.forEach((p) => p.commit(tx));
    tx.update(ref, { payments, isPaid, updatedAt: audit.at });
    writeAuditLog(tx, restaurantId, {
      action: 'cash.order_payment.created',
      entityType: 'order',
      entityId: order.id,
      context: { ...audit, orderId: order.id, shiftId: shift?.id },
      data: { count: created.length, total: created.reduce((t, p) => t + p.amount, 0), isPaid },
    });
    const change = computeChange(input.payments);
    const result: OrderPaymentResult = {
      orderId: order.id,
      isPaid,
      payments,
      ...(change !== undefined ? { change } : {}),
    };
    idem.save(tx, result);
    return result;
  });
}

export interface ReversePaymentInput {
  orderId: string;
  paymentId: string;
  reason: string;
}

/** Reversa un pago de pedido: REVERSO del movimiento + marca el pago (no se borra) + recalcula isPaid. */
export async function reverseOrderPayment(
  restaurantId: string,
  input: ReversePaymentInput,
  meta: MutationMeta
): Promise<OrderPaymentResult> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<OrderPaymentResult>(tx, {
      restaurantId,
      scope: `cash.order_payment.reverse:${input.orderId}:${input.paymentId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: { reason: input.reason },
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    const { ref, order } = await loadOrder(ctx, input.orderId);
    const payment = (order.payments ?? []).find((p) => p.id === input.paymentId);
    if (!payment) throw new CashError('PAYMENT_NOT_FOUND', 'El pago no existe en el pedido');
    if (payment.reversedAt) throw new CashError('ALREADY_REVERSED', 'El pago ya fue reversado');
    if (!payment.movementId) {
      throw new CashError(
        'LEGACY_PAYMENT',
        'Este pago es anterior al módulo de caja: registra una devolución'
      );
    }

    const movementSnap = await tx.get(
      adminDb.doc(cashDocPath(restaurantId, 'movements', payment.movementId))
    );
    if (!movementSnap.exists) throw new CashError('MOVEMENT_NOT_FOUND', 'El movimiento no existe');
    const original = { ...(movementSnap.data() as CashMovement), id: movementSnap.id };
    const shift = original.shiftId ? await ctx.shiftOf(original.shiftId) : null;
    assertReversible(original, shift);

    const prepared = await prepareRegisterMovement(
      {
        ...ctx,
        audit: {
          ...audit,
          registerId: original.registerId,
          shiftId: original.shiftId ?? undefined,
          orderId: order.id,
        },
      },
      {
        type: 'REVERSO',
        amount: original.amount,
        methodType: original.methodType,
        paymentMethodId: original.paymentMethodId,
        registerId: original.registerId,
        shiftId: original.shiftId,
        orderId: order.id,
        reason: input.reason,
        reverses: original,
      }
    );

    const payments = markPaymentReversed(order.payments ?? [], payment.id, {
      reversedAt: audit.at,
      reversedBy: audit.uid,
      reversalMovementId: prepared.movement.id,
      reversalReason: input.reason,
    });
    const isPaid = isFullyPaid({ ...order, payments });
    prepared.commit(tx);
    tx.update(ref, { payments, isPaid, updatedAt: audit.at });
    writeAuditLog(tx, restaurantId, {
      action: 'cash.order_payment.reversed',
      entityType: 'order',
      entityId: order.id,
      context: { ...audit, orderId: order.id, shiftId: original.shiftId ?? undefined },
      data: { paymentId: payment.id, amount: payment.amount, isPaid },
    });
    const result: OrderPaymentResult = { orderId: order.id, isPaid, payments };
    idem.save(tx, result);
    return result;
  });
}
