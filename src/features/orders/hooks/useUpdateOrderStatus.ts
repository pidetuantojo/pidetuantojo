import { useState } from 'react';

import { ordersService } from '../services/orders.service';
import { getWaTemplates, applyTemplate, DEFAULT_TEMPLATES } from '@/lib/whatsapp/templates';
import type { WaEventCode } from '@/lib/whatsapp/templates';

// Mapa de statusCode → eventCode de plantilla
const STATUS_TO_EVENT: Record<string, WaEventCode> = {
  confirmed:  'pedido_confirmado',
  on_the_way: 'pedido_en_camino',
  delivered:  'pedido_entregado',
  received:   'pedido_nuevo',
};

// Códigos de estado que disparan notificación WA al cliente
const WA_NOTIFY_STATUS_CODES = Object.keys(STATUS_TO_EVENT);

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
  const eventCode: WaEventCode = STATUS_TO_EVENT[data.statusCode ?? ''] ?? 'pedido_confirmado';
  try {
    const templates = await getWaTemplates(restaurantId);
    return applyTemplate(templates[eventCode], data);
  } catch {
    // Si falla Firestore, usar plantilla por defecto
    return applyTemplate(DEFAULT_TEMPLATES[eventCode], data);
  }
}

async function sendWaNotification(restaurantId: string, data: WaNotifyData): Promise<void> {
  const message = await buildMessage(restaurantId, data);
  await fetch('/api/whatsapp/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId, phone: data.customerPhone, message }),
  });
}

export function useUpdateOrderStatus(restaurantId: string) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(orderId: string, statusId: string, notifyData?: WaNotifyData): Promise<void> {
    setIsPending(true);
    setError(null);
    try {
      await ordersService.updateStatus(restaurantId, orderId, statusId);
      const shouldNotify =
        notifyData?.customerPhone &&
        (!notifyData.statusCode || WA_NOTIFY_STATUS_CODES.includes(notifyData.statusCode));
      if (shouldNotify) {
        sendWaNotification(restaurantId, notifyData!).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el estado');
      throw err;
    } finally {
      setIsPending(false);
    }
  }

  return { updateStatus, isPending, error };
}
