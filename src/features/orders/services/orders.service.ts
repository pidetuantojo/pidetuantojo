import { collection, deleteField, doc, updateDoc, setDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { AssignedDriver, CreateOrderData } from '@/types';

function ordersRef(restaurantId: string) {
  return collection(db, 'restaurants', restaurantId, 'orders');
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  return `#${timestamp}`;
}

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

  /** Actualiza el valor del domicilio y recalcula `total = subtotal (productos) + deliveryFee`. */
  async updateDeliveryFee(restaurantId: string, id: string, deliveryFee: number, subtotal: number): Promise<void> {
    await updateDoc(doc(ordersRef(restaurantId), id), {
      deliveryFee,
      total: subtotal + deliveryFee,
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
