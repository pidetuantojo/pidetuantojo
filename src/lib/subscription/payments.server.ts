// SOLO servidor: registrar y anular pagos de suscripción. Cada operación guarda el pago y mueve el
// vencimiento del restaurante en la MISMA transacción, así el registro y la fecha nunca se desalinean.
import { FieldValue } from 'firebase-admin/firestore';

import { AuthError } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';
import type { Plan, Restaurant, SubscriptionPayment } from '@/types';

import { computePaymentPeriod, currentEndYmd } from './billing';
import type { RegisterPaymentInput } from './payment.schema';

export interface Actor { uid: string; name?: string }

const paymentsCol = () => adminDb.collection('subscriptionPayments');

export async function registerSubscriptionPayment(
  input: RegisterPaymentInput,
  actor: Actor,
  receipt?: SubscriptionPayment['receipt'],
): Promise<SubscriptionPayment> {
  const restaurantRef = adminDb.collection('restaurants').doc(input.restaurantId);
  const paymentRef = paymentsCol().doc();

  return adminDb.runTransaction(async (tx) => {
    const restaurantSnap = await tx.get(restaurantRef);
    if (!restaurantSnap.exists) throw new AuthError('El restaurante no existe', 404);
    const restaurant = restaurantSnap.data() as Restaurant;
    if (!restaurant.planId) throw new AuthError('Asígnale un plan al restaurante antes de registrar pagos', 409);

    const planSnap = await tx.get(adminDb.collection('plans').doc(restaurant.planId));
    const plan = planSnap.exists ? (planSnap.data() as Plan) : undefined;
    const billingPeriod = plan?.billingPeriod ?? 'monthly';

    const period = computePaymentPeriod({
      currentEnd: currentEndYmd(restaurant, billingPeriod),
      anchorDay: restaurant.subscriptionAnchorDay,
      paidAt: input.paidAt,
      periods: input.periods,
      billingPeriod,
    });
    const now = new Date().toISOString();

    const data: Omit<SubscriptionPayment, 'id'> = {
      restaurantId: input.restaurantId,
      restaurantName: restaurant.name ?? '',
      planId: restaurant.planId,
      planName: plan?.name ?? restaurant.planName ?? '',
      billingPeriod,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method,
      ...(input.reference ? { reference: input.reference } : {}),
      ...(input.note ? { note: input.note } : {}),
      periods: input.periods,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      previousEndDate: restaurant.subscriptionEndDate ?? null,
      previousAnchorDay: restaurant.subscriptionAnchorDay ?? null,
      previousPaymentId: restaurant.lastSubscriptionPaymentId ?? null,
      ...(receipt ? { receipt } : {}),
      status: 'registered',
      createdAt: now,
      createdBy: actor.name ? { uid: actor.uid, name: actor.name } : { uid: actor.uid },
    };
    const payment: SubscriptionPayment = { id: paymentRef.id, ...data };

    tx.set(paymentRef, data);
    tx.update(restaurantRef, {
      subscriptionEndDate: period.periodEnd,
      subscriptionAnchorDay: period.anchorDay,
      lastSubscriptionPaymentId: paymentRef.id,
      updatedAt: now,
    });
    return payment;
  });
}

/**
 * Anula el último pago vigente del restaurante y deja el vencimiento como estaba antes de ese pago.
 * Solo el último: anular uno del medio dejaría los períodos siguientes calculados sobre una fecha falsa.
 */
export async function voidSubscriptionPayment(paymentId: string, reason: string, actor: Actor): Promise<{ restaurantId: string }> {
  const paymentRef = paymentsCol().doc(paymentId);

  return adminDb.runTransaction(async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) throw new AuthError('El pago no existe', 404);
    const payment = paymentSnap.data() as Omit<SubscriptionPayment, 'id'>;
    if (payment.status === 'voided') throw new AuthError('Este pago ya está anulado', 409);

    const restaurantRef = adminDb.collection('restaurants').doc(payment.restaurantId);
    const restaurantSnap = await tx.get(restaurantRef);
    const restaurant = restaurantSnap.data() as Restaurant | undefined;
    if (restaurant?.lastSubscriptionPaymentId !== paymentId) {
      throw new AuthError('Solo se puede anular el último pago registrado del restaurante', 409);
    }

    const now = new Date().toISOString();
    tx.update(paymentRef, {
      status: 'voided',
      voidedAt: now,
      voidedBy: actor.name ? { uid: actor.uid, name: actor.name } : { uid: actor.uid },
      voidReason: reason,
    });
    tx.update(restaurantRef, {
      subscriptionEndDate: payment.previousEndDate ?? FieldValue.delete(),
      subscriptionAnchorDay: payment.previousAnchorDay ?? FieldValue.delete(),
      lastSubscriptionPaymentId: payment.previousPaymentId ?? FieldValue.delete(),
      updatedAt: now,
    });
    return { restaurantId: payment.restaurantId };
  });
}

/** Comprobante de un pago (para firmar su enlace temporal). */
export async function getPaymentReceipt(paymentId: string): Promise<SubscriptionPayment['receipt'] | null> {
  const snap = await paymentsCol().doc(paymentId).get();
  if (!snap.exists) throw new AuthError('El pago no existe', 404);
  return (snap.data() as SubscriptionPayment).receipt ?? null;
}
