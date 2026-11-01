// Validación (zod) de los cuerpos de la API de caja menor.
import { z } from 'zod';

import { isValidAccountingDate } from '@/lib/shared/bogotaDate';
import { positiveMoneySchema } from '@/lib/shared/money';

import { MAX_REIMBURSEMENT_EXPENSES } from './petty.helpers';

const id = z.string().trim().min(1).max(128);
const date = z.string().refine(isValidAccountingDate, 'Fecha inválida');

function isCloudinaryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
}

export const attachmentSchema = z
  .object({
    url: z
      .string()
      .url()
      .max(500)
      .refine(isCloudinaryUrl, 'El adjunto debe estar en nuestro almacenamiento de archivos'),
    kind: z.enum(['image', 'pdf']),
    name: z.string().trim().min(1).max(120),
  })
  .strict();

export const fundSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('GENERAL'), registerId: id }).strict(),
  z.object({ kind: z.literal('BANK'), bankAccountId: id }).strict(),
]);

export const fundSchema = z
  .object({ targetAmount: positiveMoneySchema, source: fundSourceSchema })
  .strict();

export const categorySchema = z
  .object({
    name: z.string().trim().min(2, 'Escribe el nombre').max(80),
    ledgerAccountId: id,
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    ledgerAccountId: id.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios');

export const expenseSchema = z
  .object({
    registerId: id,
    concept: z.string().trim().min(3, 'Escribe el concepto').max(200),
    thirdPartyName: z.string().trim().min(2, 'Escribe el nombre del tercero').max(120),
    thirdPartyDocument: z.string().trim().min(3).max(30).optional(),
    categoryId: id,
    amount: positiveMoneySchema,
    date,
    attachments: z.array(attachmentSchema).max(5).default([]),
  })
  .strict();

export const addAttachmentSchema = z.object({ attachment: attachmentSchema }).strict();

export const annulExpenseSchema = z
  .object({ reason: z.string().trim().min(5, 'Indica el motivo').max(500) })
  .strict();

export const requestReimbursementSchema = z
  .object({
    registerId: id,
    expenseIds: z
      .array(id)
      .min(1, 'Selecciona al menos un gasto')
      .max(MAX_REIMBURSEMENT_EXPENSES, `Máximo ${MAX_REIMBURSEMENT_EXPENSES} gastos por reembolso`),
  })
  .strict();

export const approveReimbursementSchema = z.object({ source: fundSourceSchema }).strict();

export const rejectReimbursementSchema = z
  .object({ note: z.string().trim().min(5, 'Indica el motivo del rechazo').max(500) })
  .strict();

export const expenseStatusQuerySchema = z
  .enum(['PENDIENTE', 'LEGALIZADO', 'REEMBOLSADO', 'ANULADO'])
  .optional();

export const reimbursementStatusQuerySchema = z
  .enum(['PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO'])
  .optional();
