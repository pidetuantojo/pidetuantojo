// Validación (zod) de los cuerpos de la API de caja.
import { z } from 'zod';

import { moneySchema, positiveMoneySchema } from '@/lib/shared/money';

const methodType = z.enum([
  'efectivo',
  'datafono',
  'nequi',
  'daviplata',
  'breb',
  'bancolombia',
  'otro_banco',
]);

const id = z.string().trim().min(1).max(128);
const name = z.string().trim().min(2, 'Escribe el nombre').max(80);
const reason = z.string().trim().min(5, 'El motivo debe tener al menos 5 caracteres').max(500);

/** Denominación → cantidad (entero no negativo). */
export const countMapSchema = z.record(
  z.string().min(1).max(40),
  z.number().int().safe().nonnegative()
);

export const denominationSchema = z
  .object({
    key: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Llave de denominación inválida'),
    value: positiveMoneySchema,
    kind: z.enum(['BILLETE', 'MONEDA']),
  })
  .strict();

export const updateSettingsSchema = z
  .object({
    denominations: z.array(denominationSchema).min(1).max(40),
    paymentMethodAccounts: z.record(id, id),
    defaultGeneralRegisterId: id.optional(),
  })
  .strict();

const registerType = z.enum(['REGISTRADORA', 'GENERAL', 'MENOR']);

export const createRegisterSchema = z
  .object({
    type: registerType,
    name,
    ledgerAccountId: id,
    diffThreshold: moneySchema.default(0),
    fundAmount: moneySchema.optional(),
    maxExpense: moneySchema.optional(),
  })
  .strict();

export const updateRegisterSchema = z
  .object({
    name: name.optional(),
    isActive: z.boolean().optional(),
    diffThreshold: moneySchema.optional(),
    ledgerAccountId: id.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios');

export const openShiftSchema = z.object({ registerId: id, openingCount: countMapSchema }).strict();

export const createMovementSchema = z
  .object({
    type: z.enum(['INGRESO_VARIO', 'EGRESO', 'RETIRO_PARCIAL']),
    amount: positiveMoneySchema,
    methodType: methodType.default('efectivo'),
    paymentMethodId: id.optional(),
    counterpartRegisterId: id.optional(),
    reason,
  })
  .strict();

export const decideWithdrawalSchema = z
  .object({
    decision: z.enum(['APROBAR', 'RECHAZAR']),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((v) => v.decision === 'APROBAR' || (v.note && v.note.length >= 5), {
    message: 'Indica el motivo del rechazo',
    path: ['note'],
  });

export const reverseMovementSchema = z.object({ reason }).strict();

export const submitCountSchema = z
  .object({
    cashCount: countMapSchema,
    declaredByMethod: z.record(methodType, moneySchema).optional(),
    justification: z.string().trim().min(5).max(500).optional(),
  })
  .strict();

export const approveCloseSchema = z
  .object({
    decision: z.literal('APROBAR'),
    note: z.string().trim().min(5, 'Escribe una nota de aprobación').max(500),
    shortageAccountId: id.optional(),
  })
  .strict();

export const shiftStatusQuerySchema = z
  .enum(['ABIERTO', 'EN_CIERRE', 'CERRADO_PENDIENTE_APROBACION', 'CERRADO'])
  .optional();
