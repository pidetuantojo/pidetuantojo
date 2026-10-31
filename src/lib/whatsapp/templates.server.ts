import { adminDb } from '@/lib/firebase/admin';
import type { OrderDeliveryType, OrderStatus } from '@/types';

import {
  applyTemplate, DEFAULT_TEMPLATES, parseTemplateStore, statusTemplateId, templateBody,
  type WaEventCode, type WaTemplateData,
} from './templates.core';

/** Mensaje con una plantilla del restaurante (Admin SDK). Si no se pueden leer, usa la por defecto. */
export async function buildTemplateMessage(restaurantId: string, templateId: string, data: WaTemplateData): Promise<string> {
  try {
    const snap = await adminDb.collection('restaurants').doc(restaurantId).collection('settings').doc('waTemplates').get();
    return applyTemplate(templateBody(parseTemplateStore(snap.exists ? snap.data() : undefined), templateId), data);
  } catch {
    const fallback = templateId in DEFAULT_TEMPLATES ? (templateId as WaEventCode) : 'pedido_estado_actualizado';
    return applyTemplate(DEFAULT_TEMPLATES[fallback], data);
  }
}

/** Mensaje para un estado y método de entrega. undefined = el aviso está apagado ahí. */
export async function buildStatusMessage(
  restaurantId: string,
  status: Pick<OrderStatus, 'code' | 'notifyByDelivery' | 'notifyCustomer' | 'waTemplateId'> | null,
  deliveryType: OrderDeliveryType,
  data: WaTemplateData,
): Promise<string | undefined> {
  // Sin estados configurados: se comporta como "Recibido"
  const templateId = statusTemplateId(status ?? { code: 'received' }, deliveryType);
  return templateId ? buildTemplateMessage(restaurantId, templateId, data) : undefined;
}
