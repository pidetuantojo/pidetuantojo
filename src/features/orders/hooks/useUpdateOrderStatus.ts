import { useState } from 'react';

import { ordersService } from '../services/orders.service';
import { getWaTemplates, applyTemplate, DEFAULT_TEMPLATES } from '@/lib/whatsapp/templates';
import type { WaEventCode } from '@/lib/whatsapp/templates';

// Mapa de statusCode base → eventCode de plantilla específica
const STATUS_TO_EVENT: Record<string, WaEventCode> = {
  confirmed:  'pedido_confirmado',
  on_the_way: 'pedido_en_camino',
  delivered:  'pedido_entregado',
  received:   'pedido_nuevo',
  paid:       'pedido_pagado',
};

// Nunca notificar para estos códigos
const SKIP_WA_CODES = new Set(['cancelled']);

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
  items?: WaNotifyItem[];
  paymentMethod?: string;
  total?: number;
}

async function buildMessage(restaurantId: string, data: WaNotifyData): Promise<string> {
  // Usar plantilla específica si existe, si no → pedido_estado_actualizado (estados custom)
  const eventCode: WaEventCode = STATUS_TO_EVENT[data.statusCode ?? ''] ?? 'pedido_estado_actualizado';
  try {
    const templates = await getWaTemplates(restaurantId);
    return applyTemplate(templates[eventCode], data);
  } catch {
    return applyTemplate(DEFAULT_TEMPLATES[eventCode], data);
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
      await ordersService.updateStatus(restaurantId, orderId, statusId);

      if (notifyData?.customerPhone && !SKIP_WA_CODES.has(notifyData.statusCode ?? '')) {
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
