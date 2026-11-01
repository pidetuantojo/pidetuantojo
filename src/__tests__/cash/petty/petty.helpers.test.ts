import { describe, expect, it } from 'vitest';

import {
  buildPettyStatus,
  canTransitionExpense,
  canTransitionReimbursement,
  currentFund,
  isExpenseEditable,
  isFundInvariantOk,
  MAX_REIMBURSEMENT_EXPENSES,
  pendingVouchersTotal,
  sumExpenses,
} from '@/lib/cash/petty/petty.helpers';
import type { PettyExpenseStatus } from '@/lib/cash/petty/petty.types';

const e = (amount: number, status: PettyExpenseStatus) => ({ amount, status });

describe('invariante del fondo fijo', () => {
  it('suma solo los vales pendientes y legalizados', () => {
    const expenses = [
      e(10000, 'PENDIENTE'),
      e(20000, 'LEGALIZADO'),
      e(5000, 'REEMBOLSADO'),
      e(7000, 'ANULADO'),
    ];
    expect(pendingVouchersTotal(expenses)).toBe(30000);
  });

  it('efectivo + vales = fondo cumple; descuadre se detecta', () => {
    const expenses = [e(30000, 'PENDIENTE')];
    const base = { fundAmount: 100000, constituted: true, expenses };
    expect(isFundInvariantOk({ ...base, cashOnHand: 70000 })).toBe(true);
    expect(isFundInvariantOk({ ...base, cashOnHand: 69000 })).toBe(false);
  });

  it('un fondo sin constituir debe estar en cero', () => {
    const base = { fundAmount: 100000, constituted: false, expenses: [] };
    expect(isFundInvariantOk({ ...base, cashOnHand: 0 })).toBe(true);
    expect(isFundInvariantOk({ ...base, cashOnHand: 1000 })).toBe(false);
  });

  it('fondo vigente = efectivo + vales pendientes', () => {
    expect(currentFund(50000, [e(20000, 'LEGALIZADO')])).toBe(70000);
  });

  it('armar el estado cuenta por estado', () => {
    const status = buildPettyStatus({
      fundAmount: 100000,
      constituted: true,
      maxExpense: 30000,
      cashOnHand: 60000,
      expenses: [e(10000, 'PENDIENTE'), e(30000, 'LEGALIZADO'), e(9000, 'ANULADO')],
    });
    expect(status).toMatchObject({
      pendingVouchersTotal: 40000,
      invariantOk: true,
      counts: { PENDIENTE: 1, LEGALIZADO: 1, REEMBOLSADO: 0, ANULADO: 1 },
    });
  });
});

describe('total de reembolso y transiciones', () => {
  it('suma los montos de los gastos', () => {
    expect(sumExpenses([{ amount: 1500 }, { amount: 2500 }])).toBe(4000);
    expect(sumExpenses([])).toBe(0);
  });

  it('transiciones válidas e inválidas de un gasto', () => {
    expect(canTransitionExpense('PENDIENTE', 'LEGALIZADO')).toBe(true);
    expect(canTransitionExpense('PENDIENTE', 'REEMBOLSADO')).toBe(false);
    expect(canTransitionExpense('LEGALIZADO', 'REEMBOLSADO')).toBe(true);
    expect(canTransitionExpense('REEMBOLSADO', 'ANULADO')).toBe(false);
    expect(canTransitionExpense('ANULADO', 'LEGALIZADO')).toBe(false);
  });

  it('transiciones del reembolso: solo se resuelve una vez', () => {
    expect(canTransitionReimbursement('PENDIENTE_APROBACION', 'APROBADO')).toBe(true);
    expect(canTransitionReimbursement('PENDIENTE_APROBACION', 'RECHAZADO')).toBe(true);
    expect(canTransitionReimbursement('APROBADO', 'RECHAZADO')).toBe(false);
    expect(canTransitionReimbursement('RECHAZADO', 'APROBADO')).toBe(false);
  });

  it('un gasto en reembolso o cerrado no es editable', () => {
    expect(isExpenseEditable({ status: 'PENDIENTE', reimbursementId: null })).toBe(true);
    expect(isExpenseEditable({ status: 'LEGALIZADO', reimbursementId: 'rb1' })).toBe(false);
    expect(isExpenseEditable({ status: 'REEMBOLSADO', reimbursementId: null })).toBe(false);
  });

  it('el tope de gastos por reembolso respeta el límite de escrituras de Firestore', () => {
    // 5 escrituras por gasto + ~15 fijas deben caber en 500
    expect(MAX_REIMBURSEMENT_EXPENSES * 5 + 15).toBeLessThanOrEqual(500);
  });
});
