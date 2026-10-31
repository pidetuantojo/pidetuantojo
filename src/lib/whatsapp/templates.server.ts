import { adminDb } from '@/lib/firebase/admin';
import type { OrderStatus } from '@/types';

import {
  applyTemplate, DEFAULT_TEMPLATES, parseTemplateStore, statusTemplateId, templateBody,
  type WaTemplateData,
} from './templates.core';

/**
 * Mensaje de WhatsApp para un estado, con la plantilla del restaurante (Admin SDK).
 * undefined = el estado tiene el aviso apagado. Si no se pueden leer las plantillas, usa la por defecto.
 */
export async function buildStatusMessage(
  restaurantId: string,
  status: Pick<OrderStatus, 'code' | 'notifyCustomer' | 'waTemplateId'> | null,
  data: WaTemplateData,
): Promise<string | undefined> {
  // Sin estados configurados: se comporta como "Recibido"
  const templateId = statusTemplateId(status ?? { code: 'received' });
  if (!templateId) return undefined;
  try {
    const snap = await adminDb.collection('restaurants').doc(restaurantId).collection('settings').doc('waTemplates').get();
    return applyTemplate(templateBody(parseTemplateStore(snap.exists ? snap.data() : undefined), templateId), data);
  } catch {
    return applyTemplate(DEFAULT_TEMPLATES.pedido_nuevo, data);
  }
}
