// Validación (zod) de los cuerpos de la API del libro contable.
import { z } from 'zod';

import { isValidAccountingDate } from '@/lib/shared/bogotaDate';

const accountClass = z.enum(['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO']);
const accountNature = z.enum(['DEBITO', 'CREDITO']);
const accountCode = z.string().regex(/^\d{1,10}$/, 'El código debe tener entre 1 y 10 dígitos');
const accountName = z.string().trim().min(2, 'Escribe el nombre').max(120);

export const createAccountSchema = z
  .object({
    code: accountCode,
    name: accountName,
    class: accountClass,
    nature: accountNature.optional(),
    parentCode: accountCode.optional(),
    allowsMovements: z.boolean().optional(),
    needsAccountantReview: z.boolean().optional(),
  })
  .strict();

// `code` no está permitido: es inmutable (strict lo rechaza)
export const updateAccountSchema = z
  .object({
    name: accountName.optional(),
    isActive: z.boolean().optional(),
    allowsMovements: z.boolean().optional(),
    needsAccountantReview: z.boolean().optional(),
    class: accountClass.optional(),
    nature: accountNature.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios');

const accountRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), accountId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('sourceCashBox') }).strict(),
  z.object({ kind: z.literal('targetCashBox') }).strict(),
  z.object({ kind: z.literal('paymentMethod') }).strict(),
  z.object({ kind: z.literal('expenseCategory') }).strict(),
]);

const methodType = z.enum([
  'efectivo',
  'datafono',
  'nequi',
  'daviplata',
  'breb',
  'bancolombia',
  'otro_banco',
]);

export const createRuleSchema = z
  .object({
    event: z.enum([
      'SALE',
      'REFUND',
      'OTHER_INCOME',
      'EXPENSE',
      'CASH_TRANSFER',
      'BANK_DEPOSIT',
      'CASH_SURPLUS',
      'CASH_SHORTAGE',
      'PETTY_CASH_EXPENSE',
      'PETTY_CASH_REPLENISH',
      'GATEWAY_SETTLEMENT',
    ]),
    methodType: methodType.nullable(),
    debit: accountRef,
    credit: accountRef,
  })
  .strict();

export const updateRuleSchema = z.object({ debit: accountRef, credit: accountRef }).strict();

export const reverseEntrySchema = z
  .object({
    reason: z.string().trim().min(5, 'El motivo debe tener al menos 5 caracteres').max(500),
    accountingDate: z.string().refine(isValidAccountingDate, 'Fecha contable inválida').optional(),
  })
  .strict();
