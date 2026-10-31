// SOLO servidor: eventos de auditoría hechos por el sistema (carta, WhatsApp). Sin `by` = "Sistema".
import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { compactEvent, type OrderEventDraft } from './orderEvents';

/** Evento con hora del servidor. Con `actor` lo firma ese usuario; sin él es del sistema. */
export function serverEventData(draft: OrderEventDraft, actor?: { uid: string; name?: string }) {
  return compactEvent({ ...draft, at: FieldValue.serverTimestamp(), by: actor?.uid, byName: actor?.name });
}

/** Agrega un evento; si falla no rompe la operación principal (se registra en el log). */
export async function addOrderEventServer(restaurantId: string, orderId: string, draft: OrderEventDraft): Promise<void> {
  try {
    await adminDb.collection('restaurants').doc(restaurantId).collection('orders').doc(orderId)
      .collection('events').doc().set(serverEventData(draft));
  } catch (error) {
    console.error('[orderEvents] No se pudo registrar el evento:', draft.type, error);
  }
}
