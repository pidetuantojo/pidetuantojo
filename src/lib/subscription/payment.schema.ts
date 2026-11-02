// Contrato para registrar y anular pagos de suscripción (lo comparten el panel del super admin y el servidor).
import { z } from 'zod';

import type { SubscriptionPaymentMethod } from '@/types';

import { isYmd, todayYmd } from './billing';

export const PAYMENT_METHODS: { value: SubscriptionPaymentMethod; label: string }[] = [
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'transferencia', label: 'Otra transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'otro', label: 'Otro' },
];

export const MAX_PERIODS = 12;

// Comprobante: imagen o PDF de hasta 5 MB
export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

export const registerPaymentSchema = z.object({
  restaurantId: z.string().min(1),
  amount: z.coerce.number().int('El monto va sin decimales').min(0).max(100_000_000),
  paidAt: z.string().refine(isYmd, 'Fecha inválida').refine((d) => d <= todayYmd(), 'La fecha de pago no puede ser futura'),
  method: z.enum(['nequi', 'daviplata', 'bancolombia', 'transferencia', 'efectivo', 'otro']),
  periods: z.coerce.number().int().min(1).max(MAX_PERIODS),
  reference: optionalText(120),
  note: optionalText(500),
});

export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;

export const voidPaymentSchema = z.object({
  reason: z.string().trim().min(3, 'Escribe el motivo').max(300),
});
