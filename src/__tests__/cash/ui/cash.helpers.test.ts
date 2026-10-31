import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));

import { activationHint } from '@/features/cash/helpers/activation-hints.helpers';
import {
  accountLabel,
  bankAccounts,
  cashierLabel,
  collectPendingWithdrawals,
  datafonoMethods,
  differenceTone,
  generalRegisters,
  isOwnShift,
  nonCashMethods,
  openableRegisters,
  postableAccounts,
} from '@/features/cash/helpers/approvals.helpers';
import { invalidateCashQueries } from '@/features/cash/helpers/cash-queries.helpers';
import {
  validateDeposit,
  validateManualMovement,
  validateRegister,
  validateSettlement,
} from '@/features/cash/helpers/cash-forms.helpers';
import {
  canReverseMovement,
  closingOutcomeLabel,
  isJustificationRequired,
  methodTypeLabel,
  movementTypeLabel,
  shiftStatusLabel,
} from '@/features/cash/helpers/shift.helpers';
import { closingRows } from '@/features/cash/components/ClosingDetailModal/closing.helpers';
import { CashApiError } from '@/features/cash/services/cash.api';
import type { CashClosing, MovementRow } from '@/features/cash/types/cash.types';

import { account, GENERAL, PAYMENT_METHODS, REGISTER, shiftRow } from './cashUiTestUtils';

const mv = (overrides: Partial<MovementRow> = {}): MovementRow =>
  ({
    id: 'm1',
    type: 'INGRESO_VARIO',
    direction: 'IN',
    amount: 1000,
    methodType: 'efectivo',
    registerId: 'reg1',
    shiftId: 's1',
    cashierUid: 'u1',
    status: 'APLICADO',
    receiptNumber: 'RC-1',
    accountingDate: '2026-10-31',
    journalEntryId: null,
    createdAt: '2026-10-31T14:00:00.000Z',
    ...overrides,
  }) as MovementRow;

describe('shift.helpers', () => {
  it('canReverseMovement: aplicado, de tipo reversable y sin reverso', () => {
    expect(canReverseMovement(mv())).toBe(true);
    expect(canReverseMovement(mv({ type: 'EGRESO' }))).toBe(true);
    expect(canReverseMovement(mv({ status: 'PENDIENTE_APROBACION' }))).toBe(false);
    expect(canReverseMovement(mv({ status: 'RECHAZADO' }))).toBe(false);
    expect(canReverseMovement(mv({ reversedByMovementId: 'm9' }))).toBe(false);
    expect(canReverseMovement(mv({ type: 'REVERSO' }))).toBe(false);
    expect(canReverseMovement(mv({ type: 'BASE_APERTURA' }))).toBe(false);
    expect(canReverseMovement(mv({ mirrorOfMovementId: 'm0' }))).toBe(false);
  });

  it('isJustificationRequired reconoce el código del servidor', () => {
    expect(isJustificationRequired(new CashApiError(400, 'JUSTIFICATION_REQUIRED', 'x'))).toBe(
      true
    );
    expect(isJustificationRequired(new CashApiError(400, 'INVALID_COUNT', 'x'))).toBe(false);
    expect(isJustificationRequired(new Error('x'))).toBe(false);
  });

  it('etiquetas en español', () => {
    expect(movementTypeLabel('RETIRO_PARCIAL')).toBe('Retiro parcial');
    expect(shiftStatusLabel('CERRADO_PENDIENTE_APROBACION')).toBe('Pendiente de aprobación');
    expect(methodTypeLabel('datafono')).toBe('Datáfono');
  });

  it('closingOutcomeLabel solo distingue cerrado de enviado', () => {
    expect(closingOutcomeLabel('CERRADO')).toBe('Turno cerrado');
    expect(closingOutcomeLabel('CERRADO_PENDIENTE_APROBACION')).toBe('Enviado a aprobación');
  });
});

describe('approvals.helpers', () => {
  it('collectPendingWithdrawals toma solo retiros parciales pendientes', () => {
    const s1 = shiftRow({ id: 's1', status: 'ABIERTO' });
    const s2 = shiftRow({ id: 's2', status: 'ABIERTO' });
    const result = collectPendingWithdrawals([
      {
        shift: s1,
        movements: [
          mv({ id: 'a', type: 'RETIRO_PARCIAL', status: 'PENDIENTE_APROBACION' }),
          mv({ id: 'b', type: 'RETIRO_PARCIAL', status: 'APLICADO' }),
          mv({ id: 'c', type: 'EGRESO', status: 'PENDIENTE_APROBACION' }),
        ],
      },
      {
        shift: s2,
        movements: [mv({ id: 'd', type: 'RETIRO_PARCIAL', status: 'PENDIENTE_APROBACION' })],
      },
    ]);
    expect(result.map((r) => [r.shift.id, r.movement.id])).toEqual([
      ['s1', 'a'],
      ['s2', 'd'],
    ]);
  });

  it('isOwnShift', () => {
    expect(isOwnShift('u1', { cashierUid: 'u1' })).toBe(true);
    expect(isOwnShift('u1', { cashierUid: 'u2' })).toBe(false);
    expect(isOwnShift(undefined, { cashierUid: 'u2' })).toBe(false);
  });

  it('cuentas: postable = activa y que recibe asientos; bancos = además ACTIVO', () => {
    const accounts = [
      account('a', '1105', 'Caja'),
      account('b', '5195', 'Gasto', 'GASTO'),
      { ...account('c', '11', 'Grupo'), allowsMovements: false },
      { ...account('d', '1110', 'Banco viejo'), isActive: false },
    ];
    expect(postableAccounts(accounts).map((a) => a.id)).toEqual(['a', 'b']);
    expect(bankAccounts(accounts).map((a) => a.id)).toEqual(['a']);
    expect(accountLabel(accounts[0])).toBe('1105 · Caja');
  });

  it('cajas y medios de pago', () => {
    const inactive = { ...REGISTER, id: 'x', isActive: false };
    expect(openableRegisters([REGISTER, GENERAL, inactive]).map((r) => r.id)).toEqual(['reg1']);
    expect(generalRegisters([REGISTER, GENERAL, inactive]).map((r) => r.id)).toEqual(['gen1']);
    expect(nonCashMethods(PAYMENT_METHODS).map((m) => m.id)).toEqual(['pm-nequi', 'pm-datafono']);
    expect(datafonoMethods(PAYMENT_METHODS).map((m) => m.id)).toEqual(['pm-datafono']);
  });

  it('differenceTone: positivo sobrante, negativo faltante', () => {
    expect(differenceTone(0)).toBe('ok');
    expect(differenceTone(500)).toBe('surplus');
    expect(differenceTone(-500)).toBe('shortage');
  });

  it('cashierLabel', () => {
    expect(cashierLabel('u1', 'u1')).toBe('Vos');
    expect(cashierLabel('abcd1234', 'u1')).toBe('Cajero …1234');
  });
});

describe('closingRows', () => {
  it('une esperado y declarado por medio, con el efectivo primero', () => {
    const closing = {
      expectedByMethod: { nequi: 20000, efectivo: 100000 },
      declaredByMethod: { efectivo: 95000, datafono: 5000 },
      differenceByMethod: { efectivo: -5000, nequi: -20000, datafono: 5000 },
    } as unknown as CashClosing;
    expect(closingRows(closing)).toEqual([
      { methodType: 'efectivo', expected: 100000, declared: 95000, difference: -5000 },
      { methodType: 'nequi', expected: 20000, declared: 0, difference: -20000 },
      { methodType: 'datafono', expected: 0, declared: 5000, difference: 5000 },
    ]);
  });
});

describe('formularios', () => {
  it('validateManualMovement', () => {
    expect(validateManualMovement({ amount: null, reason: 'abc' }).valid).toBe(false);
    expect(
      validateManualMovement({ amount: 0, reason: 'motivo largo' }).errors.amount
    ).toBeTruthy();
    expect(validateManualMovement({ amount: 1000, reason: 'motivo largo' }).valid).toBe(true);
  });

  it('validateDeposit exige cuenta, monto y referencia', () => {
    const empty = validateDeposit({ bankAccountId: '', amount: null, externalRef: ' ' });
    expect(empty.valid).toBe(false);
    expect(Object.keys(empty.errors).filter((k) => empty.errors[k])).toEqual([
      'bankAccountId',
      'amount',
      'externalRef',
    ]);
    expect(validateDeposit({ bankAccountId: 'b', amount: 5, externalRef: 'R' }).valid).toBe(true);
  });

  it('validateSettlement valida medio y fecha contable', () => {
    const base = { bankAccountId: 'b', amount: 5, externalRef: 'R', paymentMethodId: 'pm' };
    expect(validateSettlement({ ...base, accountingDate: '' }).valid).toBe(true);
    expect(validateSettlement({ ...base, accountingDate: '2026-10-30' }).valid).toBe(true);
    expect(validateSettlement({ ...base, accountingDate: '2026-02-30' }).valid).toBe(false);
    expect(validateSettlement({ ...base, paymentMethodId: '', accountingDate: '' }).valid).toBe(
      false
    );
  });

  it('validateRegister', () => {
    expect(validateRegister({ name: 'A', ledgerAccountId: '' }).valid).toBe(false);
    expect(validateRegister({ name: 'Caja 2', ledgerAccountId: 'acc' }).valid).toBe(true);
  });
});

describe('activationHint', () => {
  it('reconoce los requisitos del servidor y manda lo demás a ajustes', () => {
    expect(activationHint('Configurar el plan de cuentas (libro contable)').action).toBe('ledger');
    expect(activationHint('Crear al menos una caja general').action).toBe('register');
    expect(activationHint('Elegir la caja general por defecto en los ajustes de caja').action).toBe(
      'settings'
    );
    expect(activationHint('Asignar la cuenta contable del medio de pago Nequi').action).toBe(
      'settings'
    );
  });
});

describe('invalidateCashQueries', () => {
  it('refresca las consultas operativas del restaurante, no ajustes ni otros restaurantes', async () => {
    const client = new QueryClient();
    const keys = [
      ['cash', 'current-shift', 'r1'],
      ['cash', 'pending', 'r1'],
      ['cash', 'settings', 'r1'],
      ['cash', 'activation', 'r1'],
      ['cash', 'pending', 'r2'],
      ['orders', 'r1'],
    ];
    keys.forEach((key) => client.setQueryData(key, 1));
    await invalidateCashQueries(client, 'r1');
    const stale = keys.filter((key) => client.getQueryState(key)?.isInvalidated);
    expect(stale).toEqual([
      ['cash', 'current-shift', 'r1'],
      ['cash', 'pending', 'r1'],
    ]);
  });
});
