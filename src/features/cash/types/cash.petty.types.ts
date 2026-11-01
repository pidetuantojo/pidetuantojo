import type { Money } from '@/lib/shared/money';
import type { AttachmentKind, FundSource, PettyReimbursement } from '@/lib/cash/petty/petty.types';

import type { MovementRow } from './cash.types';

// Solo tipos del servidor (se borran al compilar): el cliente nunca importa código de Admin SDK.
export type {
  AttachmentKind,
  FundSource,
  PettyAttachment,
  PettyCategory,
  PettyExpense,
  PettyExpenseStatus,
  PettyStatus,
  ReimbursementStatus,
} from '@/lib/cash/petty/petty.types';

/** Reembolso tal como lo devuelve la API (sin `audit`). */
export type ReimbursementRow = Omit<PettyReimbursement, 'audit'>;

export interface CreateExpenseInput {
  registerId: string;
  concept: string;
  thirdPartyName: string;
  thirdPartyDocument?: string;
  categoryId: string;
  amount: Money;
  date: string;
  attachments: { url: string; kind: AttachmentKind; name: string }[];
}

export interface FundInput {
  targetAmount: Money;
  source: FundSource;
}

export interface FundResultRow {
  registerId: string;
  previousFund: Money;
  fundAmount: Money;
  movement: MovementRow;
}

export interface CategoryInput {
  name: string;
  ledgerAccountId: string;
}

export interface UpdateCategoryInput {
  name?: string;
  ledgerAccountId?: string;
  isActive?: boolean;
}
