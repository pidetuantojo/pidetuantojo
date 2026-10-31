import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('firebase/firestore', () => ({
  arrayUnion: vi.fn(),
  collection: vi.fn(),
  deleteField: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  writeBatch: vi.fn(),
}));

import { cashErrorMessage } from '@/features/cash/helpers/cash-errors.helpers';
import { setCashModuleEnabled } from '@/features/cash/helpers/cash-module-flag';
import { CashApiError } from '@/features/cash/services/cash.api';
import { ordersService } from '@/features/orders/services/orders.service';

import { orderFixture, payment } from './orderFixture';

afterEach(() => setCashModuleEnabled(false));

describe('ordersService con caja activa', () => {
  it('addPayments, removePayment y updateIsPaid se niegan con un error claro', async () => {
    setCashModuleEnabled(true);
    const order = orderFixture({ payments: [payment()] });
    await expect(ordersService.addPayments('r1', order, [payment()])).rejects.toThrow(
      /caja está activa/
    );
    await expect(ordersService.removePayment('r1', order, 'pay1')).rejects.toThrow(
      /caja está activa/
    );
    await expect(ordersService.updateIsPaid('r1', 'o1', true)).rejects.toThrow(/caja está activa/);
  });

  it('sin caja activa siguen funcionando como antes', async () => {
    await expect(
      ordersService.addPayments('r1', orderFixture(), [payment()])
    ).resolves.toBeUndefined();
    await expect(ordersService.updateIsPaid('r1', 'o1', true)).resolves.toBeUndefined();
  });
});

describe('cashErrorMessage', () => {
  it('traduce los códigos conocidos y cae a mensajes genéricos', () => {
    expect(cashErrorMessage(new CashApiError(409, 'OVERPAYMENT', 'x'))).toBe(
      'El pago supera el saldo del pedido'
    );
    expect(cashErrorMessage(new CashApiError(403, 'UNKNOWN', 'Sin permiso'))).toMatch(/permiso/);
    expect(cashErrorMessage(new CashApiError(500, 'UNKNOWN', 'Falla del servidor'))).toBe(
      'Falla del servidor'
    );
    expect(cashErrorMessage('???')).toMatch(/No se pudo completar/);
  });
});
