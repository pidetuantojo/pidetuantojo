// Contrato del checkout público (POST /api/orders). Lo comparten el carrito y el servidor.
// El cliente manda QUÉ pidió; los precios, descuentos y totales los calcula el servidor.
import { z } from 'zod';

import type { AppliedPromotion, OrderItem } from '@/types';

export const MAX_ITEM_QUANTITY = 50;
export const MAX_ORDER_LINES = 60;

const text = (max: number) => z.string().trim().max(max);

export const checkoutItemSchema = z.object({
  productId: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
  // ids de Adicional; `additionalNames` cubre carritos guardados antes de tener id
  additionalIds: z.array(z.string().max(128)).max(30).default([]),
  additionalNames: z.array(text(120)).max(30).default([]),
  specialInstructions: text(300).default(''),
  // Clave de la línea en el carrito (para devolver el descuento de cada línea)
  key: text(64).optional(),
});

export const checkoutSchema = z.object({
  restaurantId: z.string().min(1).max(128),
  items: z.array(checkoutItemSchema).min(1, 'El pedido está vacío').max(MAX_ORDER_LINES),
  customerName: text(120).min(2, 'Escribe tu nombre'),
  customerPhone: text(40).min(7, 'Escribe un celular válido'),
  deliveryType: z.enum(['recoger', 'domicilio', 'mesa']),
  customerAddress: text(300).optional(),
  barrio: text(120).optional(),
  deliveryZoneId: z.string().max(128).optional(),
  tableId: z.string().max(128).optional(),
  scheduledFor: z.string().datetime().optional(),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  paymentMethodId: z.string().min(1, 'Elige un método de pago').max(64),
  couponCode: text(40).optional(),
  redeemLoyalty: z.boolean().default(false),
  marketingOptIn: z.boolean().default(false),
  // Promociones que el cliente vio en su carrito (se respetan unos minutos después de vencer)
  expectedPromotionIds: z.array(z.string().max(128)).max(50).default([]),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

/** Respuesta de POST /api/orders: el carrito arma el mensaje de WhatsApp con estos datos. */
export interface CheckoutResponse {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryFee?: number;
  freeDelivery: boolean;
  total: number;
  appliedPromotions: AppliedPromotion[];
  deliveryZoneName?: string;
  barrio?: string;
  tableName?: string;
  paymentLabel: string;
  paymentAccount?: string;
}

/** Errores de negocio con mensaje para el cliente (4xx). */
export class CheckoutError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 | 422 = 422) {
    super(message);
    this.name = 'CheckoutError';
  }
}

/** Respuesta de POST /api/customers/status (vista previa del carrito al escribir el celular). */
export interface CustomerStatusResponse {
  isNew: boolean;
  promoUses: Record<string, number>;
  loyalty: { stamps: number; required: number; rewardAvailable: boolean } | null;
}
