import { useState } from 'react';

import { useAuth } from '@/features/auth';
import { authFetch } from '@/lib/auth/authFetch';
import { toStatusActor } from '@/lib/orders/statusHistory';

import { ordersService } from '../services/orders.service';

type WaEvent = 'status' | 'paid';

/**
 * Pide al servidor que avise al cliente. Solo viaja qué pedido y qué evento: el servidor verifica
 * la sesión y el permiso, y saca el teléfono y el texto de Firestore (pedido + plantilla del estado).
 */
async function sendWaNotification(
  restaurantId: string,
  orderId: string,
  event: WaEvent,
): Promise<'ok' | 'disconnected' | 'error'> {
  try {
    const res = await authFetch('/api/whatsapp/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, orderId, event }),
    });
    if (res.ok) return 'ok';
    const body = await res.json().catch(() => ({}));
    const errMsg: string = body.error ?? '';
    if (errMsg.toLowerCase().includes('conectado') || errMsg.toLowerCase().includes('connected')) {
      return 'disconnected';
    }
    return 'error';
  } catch {
    return 'error';
  }
}

export function useUpdateOrderStatus(restaurantId: string) {
  const { user } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waError, setWaError] = useState<'disconnected' | null>(null);

  async function updateStatus(
    orderId: string,
    statusId: string,
    /** true = avisar al cliente por WhatsApp (el servidor vuelve a verificar si corresponde). */
    notify = false,
  ): Promise<void> {
    setIsPending(true);
    setError(null);
    setWaError(null);
    try {
      await ordersService.updateStatus(restaurantId, orderId, statusId, toStatusActor(user));

      if (notify) {
        // No bloquear el flujo principal — enviar en background
        sendWaNotification(restaurantId, orderId, 'status').then((result) => {
          if (result === 'disconnected') setWaError('disconnected');
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el estado');
      throw err;
    } finally {
      setIsPending(false);
    }
  }

  /** Envía notificación de pago sin cambiar el estado del pedido. */
  function notifyPaid(orderId: string) {
    sendWaNotification(restaurantId, orderId, 'paid').then((result) => {
      if (result === 'disconnected') setWaError('disconnected');
    });
  }

  return { updateStatus, isPending, error, waError, clearWaError: () => setWaError(null), notifyPaid };
}
