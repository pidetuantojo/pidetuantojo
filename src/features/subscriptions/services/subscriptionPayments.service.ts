import { collection, getDocs, query, where, type QuerySnapshot } from 'firebase/firestore';

import { authFetch } from '@/lib/auth/authFetch';
import { db } from '@/lib/firebase/config';
import type { SubscriptionPayment, SubscriptionPaymentMethod } from '@/types';

export interface RegisterPaymentFields {
  restaurantId: string;
  amount: number;
  paidAt: string;
  method: SubscriptionPaymentMethod;
  periods: number;
  reference?: string;
  note?: string;
  receipt?: File | null;
}

async function json<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({})) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? fallback);
  return data;
}

const paymentsRef = () => collection(db, 'subscriptionPayments');

/** Más nuevos primero (se ordena acá para no necesitar índices compuestos). */
const toPayments = (snap: QuerySnapshot) => snap.docs
  .map((d) => ({ ...(d.data() as Omit<SubscriptionPayment, 'id'>), id: d.id }))
  .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt));

// Leer: directo de Firestore (las reglas solo dejan al super admin). Escribir: solo por el servidor.
export const subscriptionPaymentsService = {
  async listByRestaurant(restaurantId: string): Promise<SubscriptionPayment[]> {
    return toPayments(await getDocs(query(paymentsRef(), where('restaurantId', '==', restaurantId))));
  },

  async listAll(): Promise<SubscriptionPayment[]> {
    return toPayments(await getDocs(paymentsRef()));
  },

  async register({ receipt, ...fields }: RegisterPaymentFields): Promise<SubscriptionPayment> {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== '') form.append(k, String(v)); });
    if (receipt) form.append('receipt', receipt);
    const res = await authFetch('/api/admin/subscription-payments', { method: 'POST', body: form });
    return json<SubscriptionPayment>(res, 'No se pudo registrar el pago');
  },

  async void(paymentId: string, reason: string): Promise<void> {
    const res = await authFetch(`/api/admin/subscription-payments/${paymentId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    await json(res, 'No se pudo anular el pago');
  },

  async receiptUrl(paymentId: string): Promise<string> {
    const res = await authFetch(`/api/admin/subscription-payments/${paymentId}/receipt`);
    return (await json<{ url: string }>(res, 'No se pudo abrir el comprobante')).url;
  },
};
