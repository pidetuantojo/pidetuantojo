import {
  arrayUnion, collection, deleteField, doc, serverTimestamp, writeBatch, type WriteBatch,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase/config';
import { compactEvent, orderEvents, type OrderEventDraft } from '@/lib/orders/orderEvents';
import { statusChange, type StatusActor } from '@/lib/orders/statusHistory';
import type { AssignedDriver, Mesa, Order, OrderItem, OrderPayment, UpdateOrderData } from '@/types';

import { applyManualDiscount, lineSubtotal, recalcAmounts } from '../helpers/amounts.helpers';
import { isFullyPaid } from '../helpers/payments.helpers';
import { getOrderTotals } from '../helpers/totals.helpers';

function ordersRef(restaurantId: string) {
  return collection(db, 'restaurants', restaurantId, 'orders');
}

/**
 * Auditoría: agrega el evento al mismo lote que el cambio (se guardan los dos o ninguno).
 * Quién y cuándo los pone Firebase: las reglas exigen by = usuario logueado y at = hora del servidor.
 */
function addEvent(batch: WriteBatch, restaurantId: string, orderId: string, draft: OrderEventDraft | null) {
  const user = auth.currentUser;
  if (!draft || !user) return;
  batch.set(doc(collection(db, 'restaurants', restaurantId, 'orders', orderId, 'events')), compactEvent({
    ...draft,
    at: serverTimestamp(),
    by: user.uid,
    byName: user.displayName || user.email || undefined,
  }));
}

/** Un cambio al pedido + su evento de auditoría, en una sola escritura. */
async function commit(restaurantId: string, orderId: string, update: Record<string, unknown>, draft: OrderEventDraft | null) {
  const batch = writeBatch(db);
  batch.update(doc(ordersRef(restaurantId), orderId), { ...update, updatedAt: new Date().toISOString() });
  addEvent(batch, restaurantId, orderId, draft);
  await batch.commit();
}

// Los pedidos se CREAN en el servidor: la carta con POST /api/orders y el panel con POST /api/orders/manual
// (calculan precios, promociones y usos). Aquí solo se modifican pedidos existentes.
export const ordersService = {
  // Los cambios de estado quedan en statusHistory (no se duplican como evento)
  async updateStatus(restaurantId: string, id: string, statusId: string, actor?: StatusActor | null): Promise<void> {
    const now = new Date().toISOString();
    await commit(restaurantId, id, {
      statusId,
      statusHistory: arrayUnion(statusChange(statusId, actor, now)),
    }, null);
  },

  /**
   * Actualiza el valor del domicilio y recalcula `total = subtotal − descuentos + deliveryFee`.
   * Si el pedido tenía domicilio gratis por promoción y se cobra un valor, deja de marcarse gratis.
   */
  async updateDeliveryFee(
    restaurantId: string,
    id: string,
    deliveryFee: number,
    order: Pick<Order, 'subtotal' | 'discount' | 'freeDelivery' | 'deliveryFee' | 'total'>,
  ): Promise<void> {
    const { total } = getOrderTotals({ ...order, deliveryFee });
    await commit(restaurantId, id, {
      deliveryFee,
      total,
      ...(order.freeDelivery && deliveryFee > 0 ? { freeDelivery: deleteField() } : {}),
    }, orderEvents.deliveryFee(order.deliveryFee, deliveryFee, order.total, total));
  },

  async updateIsPaid(restaurantId: string, id: string, isPaid: boolean): Promise<void> {
    await commit(restaurantId, id, { isPaid }, orderEvents.paidFlag(isPaid));
  },

  async updateInternalNote(restaurantId: string, order: Pick<Order, 'id' | 'internalNote'>, internalNote: string): Promise<void> {
    await commit(restaurantId, order.id, { internalNote }, orderEvents.internalNote(order.internalNote, internalNote));
  },

  async updateData(restaurantId: string, order: Order, data: UpdateOrderData): Promise<void> {
    // Firestore rechaza `undefined`: un campo explícitamente undefined significa "borrarlo"
    const payload = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
    );
    await commit(restaurantId, order.id, payload, orderEvents.edited(order, data));
  },

  async softDelete(restaurantId: string, id: string, userId: string, reason?: string): Promise<void> {
    await commit(restaurantId, id, {
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: userId,
      ...(reason?.trim() ? { deletedReason: reason.trim() } : {}),
    }, orderEvents.deleted(reason));
  },

  /** Registra pagos en caja (uno con "Pagar", varios al dividir). Queda pagado cuando cubren el total. */
  async addPayments(restaurantId: string, order: Order, payments: OrderPayment[]): Promise<void> {
    const all = [...(order.payments ?? []), ...payments];
    await commit(restaurantId, order.id, {
      // arrayUnion: dos cobros seguidos (cuenta dividida) no se pisan aunque el pedido aún no se haya refrescado
      payments: arrayUnion(...payments),
      isPaid: isFullyPaid({ ...order, payments: all }),
    }, orderEvents.paymentsAdded(payments));
  },

  async removePayment(restaurantId: string, order: Order, paymentId: string): Promise<void> {
    const rest = (order.payments ?? []).filter((p) => p.id !== paymentId);
    await commit(restaurantId, order.id, {
      payments: rest,
      isPaid: isFullyPaid({ ...order, payments: rest }),
    }, orderEvents.paymentRemoved(order.payments?.find((p) => p.id === paymentId)));
  },

  /** Descuento manual (0 = quitarlo). Se suma a las promociones en `discount`. */
  async setManualDiscount(restaurantId: string, order: Order, amount: number, reason?: string): Promise<void> {
    const { discount, manualDiscount, total } = applyManualDiscount(order, amount);
    await commit(restaurantId, order.id, {
      discount,
      total,
      manualDiscount: manualDiscount > 0 ? manualDiscount : deleteField(),
      manualDiscountReason: manualDiscount > 0 && reason?.trim() ? reason.trim() : deleteField(),
    }, orderEvents.discount(order.manualDiscount, manualDiscount, reason, order.total, total));
  },

  /** Reemplaza los productos (ej: quitar uno) recalculando montos. */
  async updateItems(restaurantId: string, order: Order, items: OrderItem[]): Promise<void> {
    const amounts = recalcAmounts(order, items);
    await commit(restaurantId, order.id, { items, ...amounts }, orderEvents.itemsRemoved(order, items, amounts.total));
  },

  /**
   * Pasa un producto (la línea completa o parte de la cantidad) a la cuenta de otra mesa.
   * Ambos pedidos se escriben juntos para que el producto no se pierda ni se duplique.
   */
  async transferItem(
    restaurantId: string,
    source: Order,
    itemIndex: number,
    quantity: number,
    target: Order,
  ): Promise<void> {
    const item = source.items[itemIndex];
    if (!item) throw new Error('El producto ya no está en el pedido');
    const qty = Math.min(Math.max(1, quantity), item.quantity);
    const ratio = qty / item.quantity;
    const moved: OrderItem = {
      ...item,
      quantity: qty,
      subtotal: lineSubtotal({ ...item, quantity: qty }),
      ...(item.discount ? { discount: Math.round(item.discount * ratio) } : {}),
    };
    const remaining: OrderItem[] = qty === item.quantity
      ? source.items.filter((_, i) => i !== itemIndex)
      : source.items.map((it, i) => i !== itemIndex ? it : {
          ...it,
          quantity: it.quantity - qty,
          subtotal: lineSubtotal({ ...it, quantity: it.quantity - qty }),
          ...(it.discount ? { discount: it.discount - (moved.discount ?? 0) } : {}),
        });
    const targetItems = [...target.items, moved];
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    batch.update(doc(ordersRef(restaurantId), source.id), { items: remaining, ...recalcAmounts(source, remaining), updatedAt: now });
    batch.update(doc(ordersRef(restaurantId), target.id), { items: targetItems, ...recalcAmounts(target, targetItems), updatedAt: now });
    addEvent(batch, restaurantId, source.id, orderEvents.itemTransferred('out', qty, item, target));
    addEvent(batch, restaurantId, target.id, orderEvents.itemTransferred('in', qty, item, source));
    await batch.commit();
  },

  async moveTable(restaurantId: string, order: Pick<Order, 'id' | 'tableName'>, mesa: Pick<Mesa, 'id' | 'name'>): Promise<void> {
    await commit(restaurantId, order.id, { tableId: mesa.id, tableName: mesa.name }, orderEvents.tableMoved(order.tableName, mesa));
  },

  /** Libera la mesa: el pedido sale del tablero (y queda entregado si aún no lo estaba). */
  async releaseTable(restaurantId: string, orderId: string, deliveredStatusId?: string, actor?: StatusActor | null): Promise<void> {
    const now = new Date().toISOString();
    await commit(restaurantId, orderId, {
      tableReleasedAt: now,
      ...(deliveredStatusId
        ? { statusId: deliveredStatusId, statusHistory: arrayUnion(statusChange(deliveredStatusId, actor, now)) }
        : {}),
    }, orderEvents.tableReleased());
  },

  async updateDriver(
    restaurantId: string,
    order: Pick<Order, 'id' | 'assignedDriver'>,
    driver: AssignedDriver | null,
  ): Promise<void> {
    await commit(restaurantId, order.id, { assignedDriver: driver ?? null }, orderEvents.driver(order.assignedDriver, driver));
  },
};
