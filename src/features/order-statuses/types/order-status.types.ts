import type { OrderDeliveryType } from '@/types';

export interface OrderStatusFormData {
  name: string;
  code: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  // Aviso de WhatsApp por método de entrega
  notifyByDelivery: Record<OrderDeliveryType, boolean>;
  waTemplateId: string;
}

