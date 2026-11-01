// Tipos de la caja menor (fondo fijo). Dinero = pesos COP enteros.
import type { AuditContext } from '@/lib/shared/audit.server';
import type { Money } from '@/lib/shared/money';

export type PettyExpenseStatus = 'PENDIENTE' | 'LEGALIZADO' | 'REEMBOLSADO' | 'ANULADO';

export const PETTY_EXPENSE_STATUSES: readonly PettyExpenseStatus[] = [
  'PENDIENTE',
  'LEGALIZADO',
  'REEMBOLSADO',
  'ANULADO',
];

export type AttachmentKind = 'image' | 'pdf';

export interface PettyAttachment {
  url: string;
  kind: AttachmentKind;
  name: string;
}

export interface PettyCategory {
  id: string;
  name: string;
  /** Cuenta GASTO/COSTO que recibe el débito al reembolsar. */
  ledgerAccountId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PettyExpense {
  id: string;
  registerId: string;
  /** Vale de caja menor (consecutivo VCM). */
  voucherNumber: string;
  concept: string;
  thirdPartyName: string;
  thirdPartyDocument?: string;
  categoryId: string;
  categoryName: string;
  /** Cuenta de la categoría al momento del gasto (el reembolso la usa tal cual). */
  ledgerAccountId: string;
  amount: Money;
  /** Fecha del gasto (YYYY-MM-DD, Bogotá). */
  date: string;
  attachments: PettyAttachment[];
  status: PettyExpenseStatus;
  movementId: string;
  reversalMovementId?: string;
  /** Reembolso activo (pendiente de aprobación) o aprobado; null si está libre. */
  reimbursementId: string | null;
  /** Asiento PETTY_CASH_EXPENSE creado al reembolsar. */
  journalEntryId?: string;
  annulReason?: string;
  legalizedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ReimbursementStatus = 'PENDIENTE_APROBACION' | 'APROBADO' | 'RECHAZADO';

export type FundSource =
  { kind: 'GENERAL'; registerId: string } | { kind: 'BANK'; bankAccountId: string };

export interface PettyReimbursement {
  id: string;
  registerId: string;
  expenseIds: string[];
  total: Money;
  status: ReimbursementStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  source?: FundSource;
  replenishMovementId?: string;
  audit: AuditContext;
}

export interface PettyStatus {
  fundAmount: Money;
  constituted: boolean;
  cashOnHand: Money;
  pendingVouchersTotal: Money;
  invariantOk: boolean;
  counts: Record<PettyExpenseStatus, number>;
  maxExpense: Money;
}
