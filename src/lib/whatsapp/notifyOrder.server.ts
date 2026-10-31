// SOLO servidor: avisa al cliente de un pedido. El panel solo dice "qué pedido y qué evento";
// el teléfono sale del pedido guardado y el texto de la plantilla del restaurante.

import { FieldValue } from 'firebase-admin/firestore';

import { getOrderTotals } from '@/features/orders/helpers/totals.helpers';
import { adminDb } from '@/lib/firebase/admin';
import type { Order, OrderStatus } from '@/types';

import { isAutoNotifyOn, sendWhatsApp, waPhone, type SendResult } from './send.server';
import { buildStatusMessage, buildTemplateMessage } from './templates.server';

export type NotifyEvent = 'status' | 'paid';

export type NotifyResult =
  | SendResult
  | { ok: true; skipped: 'mesa' | 'auto_notify_off' | 'no_phone' | 'already_sent' | 'not_paid' | 'status_silent' };

export class OrderNotFoundError extends Error {}

export async function notifyOrderEvent(restaurantId: string, orderId: string, event: NotifyEvent): Promise<NotifyResult> {
  const restaurant = adminDb.collection('restaurants').doc(restaurantId);
  const orderRef = restaurant.collection('orders').doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new OrderNotFoundError('El pedido no existe');
  const order = snap.data() as Order;

  if (order.deliveryType === 'mesa') return { ok: true, skipped: 'mesa' };
  const phone = waPhone(order.customerPhone);
  if (!phone) return { ok: true, skipped: 'no_phone' };
  if (event === 'paid' && !order.isPaid) return { ok: true, skipped: 'not_paid' };

  // Un aviso por evento: "pagado" una vez y cada estado una vez (aunque el pedido vuelva a él)
  const key = event === 'paid' ? 'paid' : `status:${order.statusId}`;
  if (order.waNotified?.includes(key)) return { ok: true, skipped: 'already_sent' };
  if (!(await isAutoNotifyOn(restaurantId))) return { ok: true, skipped: 'auto_notify_off' };

  const data = {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    total: getOrderTotals(order).total,
    paymentMethod: order.paymentMethod,
    items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
  };

  let message: string | undefined;
  if (event === 'paid') {
    message = await buildTemplateMessage(restaurantId, 'pedido_pagado', { ...data, statusName: 'Pagado' });
  } else {
    const statusSnap = await restaurant.collection('orderStatuses').doc(order.statusId).get();
    const status = statusSnap.exists ? ({ ...(statusSnap.data() as OrderStatus), id: statusSnap.id }) : null;
    // Estado borrado: no se adivina qué mandar
    message = status ? await buildStatusMessage(restaurantId, status, { ...data, statusName: status.name }) : undefined;
  }
  if (!message) return { ok: true, skipped: 'status_silent' };

  const result = await sendWhatsApp(restaurantId, phone, message);
  if (result.ok) await orderRef.update({ waNotified: FieldValue.arrayUnion(key) });
  return result;
}
