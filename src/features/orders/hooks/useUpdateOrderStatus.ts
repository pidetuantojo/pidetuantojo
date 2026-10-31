import { useState } from 'react';

import { useAuth } from '@/features/auth';
import { toStatusActor } from '@/lib/orders/statusHistory';

import { ordersService } from '../services/orders.service';
import {
  applyTemplate, DEFAULT_TEMPLATES, getWaTemplateStore, STATUS_TO_EVENT, templateBody,
} from '@/lib/whatsapp/templates';

export interface WaNotifyItem {
  productName: string;
  quantity: number;
}

export interface WaNotifyData {
  customerPhone: string;
  customerName: string;
  orderNumber: string;
  statusName: string;
  statusCode?: string;
  // Plantilla a usar (statusTemplateId del estado). Sin ella se elige por statusCode
  templateId?: string;
  items?: WaNotifyItem[];
  paymentMethod?: string;
  total?: number;
}

async function buildMessage(restaurantId: string, data: WaNotifyData): Promise<string> {
  const templateId = data.templateId ?? STATUS_TO_EVENT[data.statusCode ?? ''] ?? 'pedido_estado_actualizado';
  try {
    const store = await getWaTemplateStore(restaurantId);
    return applyTemplate(templateBody(store, templateId), data);
  } catch {
    return applyTemplate(DEFAULT_TEMPLATES.pedido_estado_actualizado, data);
  }
}

/** Envía el mensaje y devuelve 'ok', 'disconnected' o 'error'. */
async function sendWaNotification(
  restaurantId: string,
  data: WaNotifyData,
): Promise<'ok' | 'disconnected' | 'error'> {
  // Normalizar teléfono: solo dígitos. Si queda muy corto, no intentar.
  const phone = data.customerPhone.replace(/\D/g, '');
  if (phone.length < 7) return 'error';

  try {
    const message = await buildMessage(restaurantId, data);
    const res = await fetch('/api/whatsapp/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, phone, message }),
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
    /** Si se pasa notifyData, se intenta enviar WA. Si es undefined, no se notifica. */
    notifyData?: WaNotifyData,
  ): Promise<void> {
    setIsPending(true);
    setError(null);
    setWaError(null);
    try {
      await ordersService.updateStatus(restaurantId, orderId, statusId, toStatusActor(user));

      // Si el estado no avisa, quien llama no pasa notifyData (ver statusTemplateId)
      if (notifyData?.customerPhone) {
        // No bloquear el flujo principal — enviar en background
        sendWaNotification(restaurantId, notifyData).then((result) => {
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
  function notifyPaid(notifyData: WaNotifyData) {
    sendWaNotification(restaurantId, { ...notifyData, statusCode: 'paid' }).then((result) => {
      if (result === 'disconnected') setWaError('disconnected');
    });
  }

  return { updateStatus, isPending, error, waError, clearWaError: () => setWaError(null), notifyPaid };
}
