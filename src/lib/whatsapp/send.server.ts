// SOLO servidor: envía WhatsApp desde el número del restaurante.
// Nunca recibe el texto ni el teléfono desde el navegador: quien llama los saca de Firestore.

import { adminDb } from '@/lib/firebase/admin';

import { getWhatsAppSession } from './session';

const SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
const SERVICE_KEY = process.env.WHATSAPP_API_KEY;

export type SendResult = { ok: true } | { ok: false; status: number; error: string };

/** Solo dígitos; null si no alcanza para ser un teléfono. */
export function waPhone(phone: string | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 7 ? digits : null;
}

/** Toggle "Mensajes automáticos" del restaurante (settings/waConfig). */
export async function isAutoNotifyOn(restaurantId: string): Promise<boolean> {
  try {
    const snap = await adminDb.collection('restaurants').doc(restaurantId).collection('settings').doc('waConfig').get();
    return snap.data()?.autoNotify === true;
  } catch {
    return false;
  }
}

export async function sendWhatsApp(restaurantId: string, phone: string, message: string): Promise<SendResult> {
  if (SERVICE_URL) {
    const res = await fetch(`${SERVICE_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(SERVICE_KEY ? { 'x-api-key': SERVICE_KEY } : {}) },
      body: JSON.stringify({ restaurantId, phone, message }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, error: (data as { error?: string }).error ?? 'Error al enviar' };
  }

  // Dev local — singleton
  try {
    await getWhatsAppSession().sendMessage(phone, message);
    return { ok: true };
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : 'Error al enviar' };
  }
}
