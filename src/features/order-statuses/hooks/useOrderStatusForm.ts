import { useState } from 'react';
import { z } from 'zod';

import { slugify } from '@/lib/utils';
import { statusNotifies, statusTemplateChoice } from '@/lib/whatsapp/templates.core';
import type { OrderDeliveryType } from '@/types';
import type { CreateOrderStatusData, OrderStatus } from '@/types';

import type { OrderStatusFormData } from '../types/order-status.types';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  code: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .regex(/^[a-z0-9_-]+$/, 'Solo minúsculas, números, guiones y guión bajo'),
  sortOrder: z.number().int().min(1, 'Debe ser mayor a 0'),
});

function notifyDefaults(status?: OrderStatus): Record<OrderDeliveryType, boolean> {
  const base = status ?? { code: '' };
  return {
    recoger: statusNotifies(base, 'recoger'),
    domicilio: statusNotifies(base, 'domicilio'),
    mesa: statusNotifies(base, 'mesa'),
  };
}

export function useOrderStatusForm(
  restaurantId: string,
  status?: OrderStatus,
  defaultSortOrder = 1
) {
  const isEditing = !!status;

  const [data, setData] = useState<OrderStatusFormData>({
    name: status?.name ?? '',
    code: status?.code ?? '',
    color: status?.color ?? '#6b7280',
    sortOrder: status?.sortOrder ?? defaultSortOrder,
    isActive: status?.isActive ?? true,
    // Un estado nuevo avisa en para llevar y domicilio (no en mesa) con la plantilla general
    notifyByDelivery: notifyDefaults(status),
    waTemplateId: status ? statusTemplateChoice(status) : 'pedido_estado_actualizado',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof OrderStatusFormData, string>>>({});

  function handleChange<K extends keyof OrderStatusFormData>(
    field: K,
    value: OrderStatusFormData[K]
  ) {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-genera el code desde el nombre (solo en creación)
      if (field === 'name' && !isEditing) {
        next.code = slugify(value as string).replace(/-/g, '_');
      }
      return next;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const result = schema.safeParse(data);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.errors.forEach((e) => {
        const field = e.path[0] as keyof OrderStatusFormData;
        if (!fieldErrors[field]) fieldErrors[field] = e.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  }

  function toCreateData(): CreateOrderStatusData {
    return {
      restaurantId,
      name: data.name,
      code: data.code,
      color: data.color,
      sortOrder: data.sortOrder,
      isBase: false,
      isActive: data.isActive,
      notifyByDelivery: data.notifyByDelivery,
      waTemplateId: data.waTemplateId,
    };
  }

  function toUpdateData() {
    return {
      name: data.name,
      color: data.color,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      notifyByDelivery: data.notifyByDelivery,
      waTemplateId: data.waTemplateId,
    };
  }

  return { data, errors, handleChange, validate, toCreateData, toUpdateData, isEditing };
}
