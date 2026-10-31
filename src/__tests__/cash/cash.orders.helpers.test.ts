// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  isFullyPaid,
  paidAmount,
  paymentsByMethod,
} from '@/features/orders/helpers/payments.helpers';
import { CashError } from '@/lib/cash/cash.errors';
import type { CashMovement } from '@/lib/cash/cash.types';
import { computeRegisterBalance } from '@/lib/cash/expected.helpers';
import { assertShiftPolicy, assertReversible, needsMirror } from '@/lib/cash/movement.helpers';
import { buildMirrorMovement } from '@/lib/cash/movement.mirror';
import {
  assertRefundable,
  assertWithinTotal,
  computeChange,
  markPaymentReversed,
  refundableAmount,
} from '@/lib/cash/order-payments.helpers';
import type { OrderPayment } from '@/types';

const pay = (id: string, amount: number, extra: Partial<OrderPayment> = {}): OrderPayment => ({
  id,
  amount,
  method: 'Efectivo',
  paidAt: '2026-03-10T15:00:00.000Z',
  ...extra,
});
const order = { subtotal: 50000, discount: 0, deliveryFee: 0 };
const codeOf = (fn: () => void) => {
  try {
    fn();
  } catch (error) {
    return (error as CashError).code;
  }
  return null;
};

describe('pagos de pedido (puro)', () => {
  it('isFullyPaid y paidAmount ignoran los pagos reversados', () => {
    const payments = [pay('a', 30000), pay('b', 20000, { reversedAt: '2026-03-10T16:00:00.000Z' })];
    expect(paidAmount({ payments })).toBe(30000);
    expect(isFullyPaid({ ...order, payments })).toBe(false);
    expect(isFullyPaid({ ...order, payments: [pay('a', 30000), pay('c', 20000)] })).toBe(true);
    expect(paymentsByMethod({ paymentMethod: 'Efectivo', total: 50000, payments })).toEqual([
      { method: 'Efectivo', amount: 50000 },
    ]);
  });

  it('detecta sobrepago contra lo pendiente', () => {
    const payments = [pay('a', 30000)];
    expect(() => assertWithinTotal({ ...order, payments }, [20000])).not.toThrow();
    expect(codeOf(() => assertWithinTotal({ ...order, payments }, [10000, 10001]))).toBe(
      'OVERPAYMENT'
    );
    // un pago reversado libera el pendiente
    const reversed = [pay('a', 30000, { reversedAt: 'x' })];
    expect(() => assertWithinTotal({ ...order, payments: reversed }, [50000])).not.toThrow();
  });

  it('límite de devolución = pagos vigentes − devoluciones previas', () => {
    const refund = { id: 'r', movementId: 'm', amount: 15000, methodType: 'efectivo' as const };
    const o = {
      payments: [pay('a', 50000), pay('b', 9000, { reversedAt: 'x' })],
      refunds: [{ ...refund, reason: 'x', refundedAt: 'x', refundedBy: 'u' }],
    };
    expect(refundableAmount(o)).toBe(35000);
    expect(() => assertRefundable(o, 35000)).not.toThrow();
    expect(codeOf(() => assertRefundable(o, 35001))).toBe('REFUND_LIMIT');
  });

  it('cambio informativo solo con recibido', () => {
    expect(computeChange([{ paymentMethodId: 'x', amount: 1000 }])).toBeUndefined();
    expect(
      computeChange([
        { paymentMethodId: 'x', amount: 1000, received: 5000 },
        { paymentMethodId: 'y', amount: 500, received: 500 },
      ])
    ).toBe(4000);
  });

  it('marcar reversado conserva el pago', () => {
    const next = markPaymentReversed([pay('a', 1), pay('b', 2)], 'b', {
      reversedAt: 't',
      reversedBy: 'u',
      reversalMovementId: 'm',
      reversalReason: 'motivo',
    });
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ id: 'b', reversedBy: 'u' });
    expect(next[0].reversedAt).toBeUndefined();
  });
});

const movement = (extra: Partial<CashMovement>): CashMovement =>
  ({
    id: 'm1',
    type: 'RETIRO_PARCIAL',
    direction: 'OUT',
    amount: 1000,
    methodType: 'efectivo',
    registerId: 'reg1',
    counterpartRegisterId: 'gen',
    shiftId: 's1',
    cashierUid: 'c',
    status: 'APLICADO',
    receiptNumber: 'TR-000001',
    accountingDate: '2026-03-10',
    journalEntryId: 'e1',
    transferId: 'm1',
    reversedByMovementId: 'rv',
    audit: { uid: 'c', at: 'x', accountingDate: 'x', ip: null, userAgent: null },
    createdAt: 'x',
    ...extra,
  }) as CashMovement;

describe('espejos y saldo de caja sin turno (puro)', () => {
  it('el espejo invierte el sentido, no tiene turno y comparte asiento', () => {
    const original = movement({});
    const mirror = buildMirrorMovement(original, 'mir1');
    expect(mirror).toMatchObject({
      id: 'mir1',
      direction: 'IN',
      registerId: 'gen',
      counterpartRegisterId: 'reg1',
      shiftId: null,
      journalEntryId: 'e1',
      transferId: 'm1',
      mirrorOfMovementId: 'm1',
    });
    expect(mirror.reversedByMovementId).toBeUndefined();
    expect(() => assertReversible(mirror, null)).toThrow(CashError);
  });

  it('saldo de la general = entradas − salidas aplicadas, con espejos', () => {
    const base = movement({ type: 'BASE_APERTURA', direction: 'IN', amount: 100000 });
    const withdrawal = movement({ id: 'm2', amount: 30000 });
    const closing = movement({ id: 'm3', type: 'TRASLADO_CIERRE', amount: 70000 });
    const mirrors = [base, withdrawal, closing].map((m) => buildMirrorMovement(m, `mir-${m.id}`));
    const deposit = movement({
      id: 'm4',
      type: 'CONSIGNACION',
      registerId: 'gen',
      shiftId: null,
      amount: 20000,
      counterpartRegisterId: undefined,
    });
    const pending = movement({ id: 'm5', status: 'PENDIENTE_APROBACION', amount: 999 });
    const all = [...mirrors, deposit, buildMirrorMovement(pending, 'mir-m5')];
    // base sale (-100000) y regresa en retiro y cierre (+30000 +70000), consignación -20000
    expect(computeRegisterBalance(all, 'gen').efectivo).toBe(-100000 + 30000 + 70000 - 20000);
    expect(computeRegisterBalance(mirrors, 'gen').efectivo).toBe(0);
  });

  it('política de turno y necesidad de espejo', () => {
    const cash = { type: 'VENTA' as const, methodType: 'efectivo' as const, shiftId: null };
    expect(codeOf(() => assertShiftPolicy(cash, { type: 'GENERAL' }))).toBe('SHIFT_REQUIRED');
    expect(() =>
      assertShiftPolicy({ ...cash, methodType: 'nequi' }, { type: 'GENERAL' })
    ).not.toThrow();
    expect(
      codeOf(() => assertShiftPolicy({ ...cash, methodType: 'nequi' }, { type: 'REGISTRADORA' }))
    ).toBe('SHIFT_REQUIRED');
    expect(needsMirror({ type: 'RETIRO_PARCIAL', status: 'APLICADO' })).toBe(true);
    expect(needsMirror({ type: 'RETIRO_PARCIAL', status: 'PENDIENTE_APROBACION' })).toBe(false);
    expect(needsMirror({ type: 'VENTA', status: 'APLICADO' })).toBe(false);
    expect(needsMirror({ type: 'REVERSO', status: 'APLICADO' }, { transferId: 'x' })).toBe(true);
    expect(needsMirror({ type: 'REVERSO', status: 'APLICADO' }, {})).toBe(false);
  });
});
