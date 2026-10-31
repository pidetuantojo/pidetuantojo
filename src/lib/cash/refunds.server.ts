// SOLO servidor: devoluciones de dinero al cliente. Una devolución es un movimiento DEVOLUCION en el
// turno ACTUAL de quien devuelve (puede ser distinto al turno de la venta original).
import { getConfiguredPaymentMethods } from '@/features/payment-methods/helpers/payment-methods.helpers';
import { adminDb } from '@/lib/firebase/admin';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';
import type { OrderRefund } from '@/types';

import { CashError } from './cash.errors';
import { createMovementContext } from './movement.context.server';
import { prepareRegisterMovement } from './movement.server';
import { assertRefundable } from './order-payments.helpers';
import { loadOrder } from './order-payments.load.server';
import { resolveOpenShift, resolveTarget } from './shift.resolve.server';

export interface RefundInput {
  orderId: string;
  paymentMethodId: string;
  amount: number;
  reason: string;
}

export interface RefundResult {
  orderId: string;
  refund: OrderRefund;
  refunds: OrderRefund[];
}

export async function refundOrder(
  restaurantId: string,
  input: RefundInput,
  meta: MutationMeta
): Promise<RefundResult> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<RefundResult>(tx, {
      restaurantId,
      scope: `cash.refund.create:${input.orderId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    const { ref, order, restaurant } = await loadOrder(ctx, input.orderId);
    const method = getConfiguredPaymentMethods(restaurant.paymentMethods).find(
      (m) => m.id === input.paymentMethodId
    );
    if (!method) {
      throw new CashError('METHOD_NOT_ALLOWED', 'El medio de pago no existe en el restaurante');
    }
    assertRefundable(order, input.amount);

    const shift = await resolveOpenShift(ctx, audit.uid);
    const target = resolveTarget(ctx, method.type, shift);
    const prepared = await prepareRegisterMovement(
      {
        ...ctx,
        audit: {
          ...audit,
          registerId: target.registerId,
          shiftId: target.shiftId ?? undefined,
          orderId: order.id,
          reason: input.reason,
        },
      },
      {
        type: 'DEVOLUCION',
        amount: input.amount,
        methodType: method.type,
        paymentMethodId: method.id,
        ...target,
        orderId: order.id,
        reason: input.reason,
      }
    );

    const refund: OrderRefund = {
      id: `refund_${prepared.movement.id}`,
      movementId: prepared.movement.id,
      amount: input.amount,
      methodType: method.type,
      paymentMethodId: method.id,
      reason: input.reason,
      refundedAt: audit.at,
      refundedBy: audit.uid,
    };
    const refunds = [...(order.refunds ?? []), refund];
    prepared.commit(tx);
    tx.update(ref, { refunds, updatedAt: audit.at });
    writeAuditLog(tx, restaurantId, {
      action: 'cash.refund.created',
      entityType: 'order',
      entityId: order.id,
      context: {
        ...audit,
        orderId: order.id,
        shiftId: target.shiftId ?? undefined,
        registerId: target.registerId,
        reason: input.reason,
      },
      data: { amount: input.amount, movementId: prepared.movement.id },
    });
    const result: RefundResult = { orderId: order.id, refund, refunds };
    idem.save(tx, result);
    return result;
  });
}
