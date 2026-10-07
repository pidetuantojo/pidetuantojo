import { useState } from 'react';

import { ordersService } from '../services/orders.service';

// Códigos de estado que disparan notificación WA al cliente
const WA_NOTIFY_STATUS_CODES = ['confirmed'];

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

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

function buildMessage(data: WaNotifyData): string {
  const lines: string[] = [];

  lines.push(`Hola ${data.customerName}! 👋`);
  lines.push(`Tu pedido *#${data.orderNumber}* fue *${data.statusName}* ✅`);

  if (data.items?.length) {
    lines.push('');
    lines.push('*🛒 Productos:*');
    data.items.forEach((item) => {
      lines.push(`  • ${item.quantity}x ${item.productName}`);
    });
  }

  if (data.total !== undefined || data.paymentMethod) {
    lines.push('');
    if (data.total !== undefined) lines.push(`*💰 Total:* ${formatCOP(data.total)}`);
    if (data.paymentMethod) lines.push(`*💳 Pago:* ${data.paymentMethod}`);
  }

  return lines.join('\n');
}

async function sendWaNotification(restaurantId: string, data: WaNotifyData): Promise<void> {
  await fetch('/api/whatsapp/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId, phone: data.customerPhone, message: buildMessage(data) }),
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
