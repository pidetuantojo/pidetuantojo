import { arrayUnion, collection, deleteField, doc, updateDoc, setDoc, writeBatch } from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import { generateOrderNumber } from '@/lib/orders/orderNumber';
import type { AssignedDriver, CreateOrderData, Mesa, Order, OrderItem, OrderPayment } from '@/types';

import { applyManualDiscount, lineSubtotal, recalcAmounts } from '../helpers/amounts.helpers';
import { isFullyPaid } from '../helpers/payments.helpers';
import { getOrderTotals } from '../helpers/totals.helpers';

function ordersRef(restaurantId: string) {
  return collection(db, 'restaurants', restaurantId, 'orders');
}

// Pedidos del menú público: POST /api/orders (el servidor calcula precios y promociones).
// Aquí solo se crean pedidos manuales del panel (regla: orders.create).
export const ordersService = {
  async create(data: CreateOrderData): Promise<{ id: string; orderNumber: string }> {
    const now = new Date().toISOString();
    const ref = doc(ordersRef(data.restaurantId));
    const orderNumber = generateOrderNumber();
    await setDoc(ref, {
      ...data,
      id: ref.id,
      orderNumber,
      createdAt: now,
      updatedAt: now,
    });
    return { id: ref.id, orderNumber };
  },

  async updateStatus(restaurantId: string, id: string, statusId: string): Promise<void> {
    await updateDoc(doc(ordersRef(restaurantId), id), {
      statusId,
      updatedAt: new Date().toISOString(),
    });
  },

  async updateNotes(restaurantId: string, id: string, notes: string): Promise<void> {
    await updateDoc(doc(ordersRef(restaurantId), id), {
      notes,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Actualiza el valor del domicilio y recalcula `total = subtotal − descuentos + deliveryFee`.
   * Si el pedido tenía domicilio gratis por promoción y se cobra un valor, deja de marcarse gratis.
   */
  async updateDeliveryFee(
    restaurantId: string,
    id: string,
    deliveryFee: number,
    order: Pick<Order, 'subtotal' | 'discount' | 'freeDelivery'>,
  ): Promise<void> {
    const { total } = getOrderTotals({ ...order, deliveryFee });
    await updateDoc(doc(ordersRef(restaurantId), id), {
      deliveryFee,
      total,
      ...(order.freeDelivery && deliveryFee > 0 ? { freeDelivery: deleteField() } : {}),
      updatedAt: new Date().toISOString(),
    });
  },

  async updateIsPaid(restaurantId: string, id: string, isPaid: boolean): Promise<void> {
    await updateDoc(doc(ordersRef(restaurantId), id), {
      isPaid,
      updatedAt: new Date().toISOString(),
    });
  },

  async updateInternalNote(restaurantId: string, id: string, internalNote: string): Promise<void> {
    await updateDoc(doc(ordersRef(restaurantId), id), {
      internalNote,
      updatedAt: new Date().toISOString(),
    });
  },

  async updateData(restaurantId: string, id: string, data: import('@/types').UpdateOrderData): Promise<void> {
    // Firestore rechaza `undefined`: un campo explícitamente undefined significa "borrarlo"
    const payload = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
    );
    await updateDoc(doc(ordersRef(restaurantId), id), {
      ...payload,
      updatedAt: new Date().toISOString(),
    });
  },

  async softDelete(restaurantId: string, id: string, userId: string, reason?: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(ordersRef(restaurantId), id), {
      isDeleted: true,
      deletedAt: now,
      deletedBy: userId,
      ...(reason?.trim() ? { deletedReason: reason.trim() } : {}),
      updatedAt: now,
    });
  },

  /** Registra pagos en caja (uno con "Pagar", varios al dividir). Queda pagado cuando cubren el total. */
  async addPayments(restaurantId: string, order: Order, payments: OrderPayment[]): Promise<void> {
    const all = [...(order.payments ?? []), ...payments];
    await updateDoc(doc(ordersRef(restaurantId), order.id), {
      // arrayUnion: dos cobros seguidos (cuenta dividida) no se pisan aunque el pedido aún no se haya refrescado
      payments: arrayUnion(...payments),
      isPaid: isFullyPaid({ ...order, payments: all }),
      updatedAt: new Date().toISOString(),
    });
  },

  async removePayment(restaurantId: string, order: Order, paymentId: string): Promise<void> {
    const rest = (order.payments ?? []).filter((p) => p.id !== paymentId);
    await updateDoc(doc(ordersRef(restaurantId), order.id), {
      payments: rest,
      isPaid: isFullyPaid({ ...order, payments: rest }),
      updatedAt: new Date().toISOString(),
    });
  },

  /** Descuento manual (0 = quitarlo). Se suma a las promociones en `discount`. */
  async setManualDiscount(restaurantId: string, order: Order, amount: number, reason?: string): Promise<void> {
    const { discount, manualDiscount, total } = applyManualDiscount(order, amount);
    await updateDoc(doc(ordersRef(restaurantId), order.id), {
      discount,
      total,
      manualDiscount: manualDiscount > 0 ? manualDiscount : deleteField(),
      manualDiscountReason: manualDiscount > 0 && reason?.trim() ? reason.trim() : deleteField(),
      updatedAt: new Date().toISOString(),
    });
  },

  /** Reemplaza los productos (ej: quitar uno) recalculando montos. */
  async updateItems(restaurantId: string, order: Order, items: OrderItem[]): Promise<void> {
    await updateDoc(doc(ordersRef(restaurantId), order.id), {
      items,
      ...recalcAmounts(order, items),
      updatedAt: new Date().toISOString(),
    });
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
    await batch.commit();
  },

  async moveTable(restaurantId: string, orderId: string, mesa: Pick<Mesa, 'id' | 'name'>): Promise<void> {
    await updateDoc(doc(ordersRef(restaurantId), orderId), {
      tableId: mesa.id,
      tableName: mesa.name,
      updatedAt: new Date().toISOString(),
    });
  },

  /** Libera la mesa: el pedido sale del tablero (y queda entregado si aún no lo estaba). */
  async releaseTable(restaurantId: string, orderId: string, deliveredStatusId?: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(ordersRef(restaurantId), orderId), {
      tableReleasedAt: now,
      ...(deliveredStatusId ? { statusId: deliveredStatusId } : {}),
      updatedAt: now,
    });
  },

  async updateDriver(
    restaurantId: string,
    orderId: string,
    driver: AssignedDriver | null,
  ): Promise<void> {
    await updateDoc(doc(ordersRef(restaurantId), orderId), {
      assignedDriver: driver ?? null,
      updatedAt: new Date().toISOString(),
    });
  },
};
