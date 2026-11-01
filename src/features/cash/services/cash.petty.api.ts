import type {
  CategoryInput,
  CreateExpenseInput,
  FundInput,
  FundResultRow,
  FundSource,
  PettyAttachment,
  PettyCategory,
  PettyExpense,
  PettyExpenseStatus,
  PettyStatus,
  ReimbursementRow,
  UpdateCategoryInput,
} from '../types/cash.petty.types';

import { request } from './cash.http';

const enc = encodeURIComponent;
const PETTY = '/api/cash/petty';

/** Caja menor: fondo, vales (gastos), reembolsos y categorías. */
export const cashPettyApi = {
  getPettyStatus: (registerId: string) =>
    request<PettyStatus>(`${PETTY}/${enc(registerId)}/status`),

  setPettyFund: (registerId: string, input: FundInput, idempotencyKey: string) =>
    request<FundResultRow>(`${PETTY}/${enc(registerId)}/fund`, {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  listPettyExpenses: async (registerId: string, status?: PettyExpenseStatus) =>
    (
      await request<{ expenses: PettyExpense[] }>(
        `${PETTY}/expenses?registerId=${enc(registerId)}${status ? `&status=${status}` : ''}`
      )
    ).expenses,

  createPettyExpense: (input: CreateExpenseInput, idempotencyKey: string) =>
    request<PettyExpense>(`${PETTY}/expenses`, { method: 'POST', body: input, idempotencyKey }),

  addPettyAttachment: (expenseId: string, attachment: PettyAttachment, idempotencyKey: string) =>
    request<PettyExpense>(`${PETTY}/expenses/${enc(expenseId)}/attachments`, {
      method: 'POST',
      body: { attachment },
      idempotencyKey,
    }),

  legalizePettyExpense: (expenseId: string, idempotencyKey: string) =>
    request<PettyExpense>(`${PETTY}/expenses/${enc(expenseId)}/legalize`, {
      method: 'POST',
      idempotencyKey,
    }),

  annulPettyExpense: (expenseId: string, reason: string, idempotencyKey: string) =>
    request<PettyExpense>(`${PETTY}/expenses/${enc(expenseId)}/annul`, {
      method: 'POST',
      body: { reason },
      idempotencyKey,
    }),

  listPettyReimbursements: async (registerId: string) =>
    (
      await request<{ reimbursements: ReimbursementRow[] }>(
        `${PETTY}/reimbursements?registerId=${enc(registerId)}`
      )
    ).reimbursements,

  requestPettyReimbursement: (
    input: { registerId: string; expenseIds: string[] },
    idempotencyKey: string
  ) =>
    request<ReimbursementRow>(`${PETTY}/reimbursements`, {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  approvePettyReimbursement: (id: string, source: FundSource, idempotencyKey: string) =>
    request<ReimbursementRow>(`${PETTY}/reimbursements/${enc(id)}/approve`, {
      method: 'POST',
      body: { source },
      idempotencyKey,
    }),

  rejectPettyReimbursement: (id: string, note: string, idempotencyKey: string) =>
    request<ReimbursementRow>(`${PETTY}/reimbursements/${enc(id)}/reject`, {
      method: 'POST',
      body: { note },
      idempotencyKey,
    }),

  listPettyCategories: async () =>
    (await request<{ categories: PettyCategory[] }>(`${PETTY}/categories`)).categories,

  createPettyCategory: (input: CategoryInput, idempotencyKey: string) =>
    request<PettyCategory>(`${PETTY}/categories`, {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  updatePettyCategory: (id: string, input: UpdateCategoryInput, idempotencyKey: string) =>
    request<PettyCategory>(`${PETTY}/categories/${enc(id)}`, {
      method: 'PATCH',
      body: input,
      idempotencyKey,
    }),
};
