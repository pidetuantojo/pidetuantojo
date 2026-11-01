import { describe, expect, it } from 'vitest';

import {
  attachmentKindOf,
  canApproveReimbursement,
  isExpenseOpen,
  selectableForReimbursement,
  sumSelected,
  validateExpense,
  validateFund,
  validatePettyRegister,
} from '@/features/cash/helpers/petty-forms.helpers';
import type { PettyExpense } from '@/features/cash/types/cash.petty.types';

const expense = (id: string, overrides: Partial<PettyExpense> = {}): PettyExpense => ({
  id,
  registerId: 'm1',
  voucherNumber: `VCM-00000${id}`,
  concept: 'Insumos',
  thirdPartyName: 'Tercero Ficticio',
  categoryId: 'c1',
  categoryName: 'Aseo',
  ledgerAccountId: 'acc',
  amount: 10000,
  date: '2026-10-31',
  attachments: [],
  status: 'LEGALIZADO',
  movementId: 'mv',
  reimbursementId: null,
  createdBy: 'u1',
  createdAt: '2026-10-31T13:00:00.000Z',
  updatedAt: '2026-10-31T13:00:00.000Z',
  ...overrides,
});

const draft = {
  amount: 20000,
  maxExpense: 50000,
  concept: 'Compra de bolsas',
  thirdPartyName: 'Tienda Ficticia',
  thirdPartyDocument: '',
  categoryId: 'c1',
  date: '2026-10-31',
};

describe('validateExpense', () => {
  it('acepta un gasto completo', () => {
    expect(validateExpense(draft).valid).toBe(true);
  });

  it('exige monto positivo, dentro del máximo, concepto, tercero, categoría y fecha', () => {
    expect(validateExpense({ ...draft, amount: null }).errors.amount).toBeTruthy();
    expect(validateExpense({ ...draft, amount: 0 }).errors.amount).toBeTruthy();
    expect(validateExpense({ ...draft, amount: 50001 }).errors.amount).toMatch(/máximo/);
    expect(validateExpense({ ...draft, concept: ' ' }).errors.concept).toBeTruthy();
    expect(validateExpense({ ...draft, thirdPartyName: '' }).errors.thirdPartyName).toBeTruthy();
    expect(validateExpense({ ...draft, categoryId: '' }).errors.categoryId).toBeTruthy();
    expect(validateExpense({ ...draft, date: '2026-13-40' }).errors.date).toBeTruthy();
  });

  it('el documento del tercero es opcional pero no puede ser absurdamente corto', () => {
    expect(validateExpense({ ...draft, thirdPartyDocument: '' }).valid).toBe(true);
    expect(
      validateExpense({ ...draft, thirdPartyDocument: '1' }).errors.thirdPartyDocument
    ).toBeTruthy();
  });
});

describe('reembolsos y adjuntos', () => {
  it('solo los legalizados y libres son seleccionables; el total suma lo marcado', () => {
    const list = [
      expense('1'),
      expense('2', { status: 'PENDIENTE' }),
      expense('3', { reimbursementId: 'rb' }),
      expense('4', { amount: 5000 }),
    ];
    const selectable = selectableForReimbursement(list);
    expect(selectable.map((e) => e.id)).toEqual(['1', '4']);
    expect(sumSelected(selectable, new Set(['1', '4']))).toBe(15000);
    expect(sumSelected(selectable, new Set())).toBe(0);
  });

  it('un gasto en reembolso o cerrado no admite adjuntar ni anular', () => {
    expect(isExpenseOpen(expense('1'))).toBe(true);
    expect(isExpenseOpen(expense('1', { reimbursementId: 'rb' }))).toBe(false);
    expect(isExpenseOpen(expense('1', { status: 'REEMBOLSADO' }))).toBe(false);
  });

  it('el tipo del adjunto sale del MIME', () => {
    expect(attachmentKindOf('application/pdf')).toBe('pdf');
    expect(attachmentKindOf('image/png')).toBe('image');
    expect(attachmentKindOf('image/svg+xml')).toBeNull();
  });
});

describe('aprobación', () => {
  const pending = { status: 'PENDIENTE_APROBACION' as const, requestedBy: 'u1' };

  it('quien solicitó no puede aprobar su propio reembolso', () => {
    expect(canApproveReimbursement(pending, 'u1', true)).toBe(false);
    expect(canApproveReimbursement(pending, 'u2', true)).toBe(true);
  });

  it('exige el permiso y que siga pendiente', () => {
    expect(canApproveReimbursement(pending, 'u2', false)).toBe(false);
    expect(canApproveReimbursement({ ...pending, status: 'APROBADO' }, 'u2', true)).toBe(false);
  });
});

describe('fondo y registro de caja menor', () => {
  it('valida fondo y origen', () => {
    const ok = {
      target: 200000,
      sourceKind: 'GENERAL' as const,
      generalId: 'g1',
      bankAccountId: '',
      maxExpense: 50000,
    };
    expect(validateFund(ok).valid).toBe(true);
    expect(validateFund({ ...ok, target: 40000 }).errors.target).toBeTruthy();
    expect(validateFund({ ...ok, generalId: '' }).errors.source).toBeTruthy();
    expect(validateFund({ ...ok, sourceKind: 'BANK' }).errors.source).toBeTruthy();
    expect(validateFund({ ...ok, sourceKind: 'BANK', bankAccountId: 'b1' }).valid).toBe(true);
  });

  it('la caja menor exige fondo y máximo coherente; otras cajas no validan', () => {
    expect(
      validatePettyRegister({ isPetty: false, fundAmount: null, maxExpense: null }).valid
    ).toBe(true);
    const petty = { isPetty: true, fundAmount: 100000, maxExpense: 30000 };
    expect(validatePettyRegister(petty).valid).toBe(true);
    expect(validatePettyRegister({ ...petty, fundAmount: null }).errors.fundAmount).toBeTruthy();
    expect(validatePettyRegister({ ...petty, maxExpense: 100001 }).errors.maxExpense).toBeTruthy();
    expect(validatePettyRegister({ ...petty, maxExpense: null }).errors.maxExpense).toBeTruthy();
  });
});
