import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { METHODS, orderFixture, payment } from './orderFixture';

const mocks = vi.hoisted(() => ({
  cashEnabled: { value: true },
  shift: { value: { id: 's1', status: 'ABIERTO' } as { id: string; status: string } | null },
  payOrder: vi.fn(),
  reversePayment: vi.fn(),
  refund: vi.fn(),
  addPayments: vi.fn(),
}));

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { uid: 'u1', restaurantId: 'r1' }, can: () => true }),
}));
vi.mock('@/features/cash/hooks/useCashModule', () => ({
  useCashModule: () => ({ enabled: mocks.cashEnabled.value }),
}));
vi.mock('@/features/cash/hooks/useCashQueries', () => ({
  useCurrentShift: () => ({ isSuccess: true, data: mocks.shift.value }),
}));
vi.mock('@/features/cash/services/cash.api', () => {
  class CashApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string
    ) {
      super(message);
    }
  }
  return {
    CashApiError,
    cashApi: {
      payOrder: mocks.payOrder,
      reversePayment: mocks.reversePayment,
      refund: mocks.refund,
    },
  };
});
vi.mock('@/features/orders/services/orders.service', () => ({
  ordersService: { addPayments: mocks.addPayments, removePayment: vi.fn(), updateIsPaid: vi.fn() },
}));

import { PaymentDialog } from '@/features/orders/components/OrderDrawer/PaymentDialog';
import { OrderPaymentsList } from '@/features/orders/components/OrderPayments';
import { RefundDialog } from '@/features/orders/components/OrderPayments/RefundDialog';
import { ReversePaymentDialog } from '@/features/orders/components/OrderPayments/ReversePaymentDialog';
import { refundableAmount } from '@/lib/cash/order-payments.helpers';
import { useToastStore } from '@/store/toast.store';

beforeEach(() => {
  Object.values(mocks).forEach((m) => 'mockReset' in m && m.mockReset());
  mocks.cashEnabled.value = true;
  mocks.shift.value = { id: 's1', status: 'ABIERTO' };
  useToastStore.setState({ toasts: [] });
});

describe('refundableAmount (puro)', () => {
  it('pagos vigentes menos devoluciones; ignora reversados', () => {
    const order = orderFixture({
      payments: [
        payment({ id: 'a', amount: 30000 }),
        payment({ id: 'b', amount: 20000 }),
        payment({ id: 'c', amount: 99000, reversedAt: '2026-03-10T16:00:00.000Z' }),
      ],
      refunds: [
        {
          id: 'r1',
          movementId: 'm',
          amount: 12000,
          methodType: 'efectivo',
          reason: 'x',
          refundedAt: '',
          refundedBy: 'u',
        },
      ],
    });
    expect(refundableAmount(order)).toBe(38000);
    expect(refundableAmount(orderFixture())).toBe(0);
  });
});

describe('PaymentDialog', () => {
  const renderDialog = () =>
    render(
      <PaymentDialog
        order={orderFixture()}
        restaurantId="r1"
        paymentMethods={METHODS}
        mode="pay"
        onClose={vi.fn()}
      />
    );

  it('con caja activa y sin turno abierto deshabilita el efectivo y muestra la pista', () => {
    mocks.shift.value = null;
    renderDialog();
    expect(screen.getByRole('button', { name: /Efectivo/ })).toBeDisabled();
    expect(screen.getByText('Abrí un turno para cobrar en efectivo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nequi/ })).toBeEnabled();
  });

  it('con un turno abierto el efectivo se puede elegir', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /Efectivo/ })).toBeEnabled();
    expect(screen.queryByText('Abrí un turno para cobrar en efectivo')).not.toBeInTheDocument();
  });

  it('con caja activa cobra por cashApi.payOrder (no por Firestore) y muestra el cambio', async () => {
    mocks.payOrder.mockResolvedValue({ orderId: 'o1', isPaid: true, payments: [], change: 5000 });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Efectivo/ }));
    fireEvent.change(screen.getByLabelText('Recibido en efectivo'), { target: { value: '55000' } });
    fireEvent.click(screen.getByRole('button', { name: /Cobrar/ }));

    await waitFor(() => expect(mocks.payOrder).toHaveBeenCalledTimes(1));
    const [input, key] = mocks.payOrder.mock.calls[0] as [unknown, string];
    expect(input).toEqual({
      orderId: 'o1',
      payments: [{ paymentMethodId: 'pm-efectivo', amount: 50000, received: 55000 }],
    });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.addPayments).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]?.msg).toMatch(/Cambio: .*5\.000/)
    );
  });

  it('un error de la API se muestra en español y no cierra el diálogo', async () => {
    const { CashApiError } = await import('@/features/cash/services/cash.api');
    mocks.payOrder.mockRejectedValue(new CashApiError(409, 'SHIFT_REQUIRED', 'x'));
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Cobrar/ }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]?.msg).toBe(
        'Abrí un turno de caja para cobrar en efectivo'
      )
    );
    expect(useToastStore.getState().toasts[0]?.type).toBe('error');
  });

  it('el reintento del mismo envío reutiliza la llave de idempotencia', async () => {
    mocks.payOrder.mockRejectedValueOnce(new Error('red caída')).mockResolvedValue({
      orderId: 'o1',
      isPaid: true,
      payments: [],
    });
    renderDialog();
    const button = () => screen.getByRole('button', { name: /Cobrar/ });
    fireEvent.click(button());
    await waitFor(() => expect(mocks.payOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button()).not.toBeDisabled());
    fireEvent.click(button());
    await waitFor(() => expect(mocks.payOrder).toHaveBeenCalledTimes(2));
    expect(mocks.payOrder.mock.calls[1][1]).toBe(mocks.payOrder.mock.calls[0][1]);
  });

  it('deshabilita el envío mientras la petición está pendiente', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mocks.payOrder.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Cobrar/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Guardando/ })).toBeDisabled());
    await act(async () => finish({ orderId: 'o1', isPaid: true, payments: [] }));
  });

  it('sin caja activa usa el servicio de siempre', async () => {
    mocks.cashEnabled.value = false;
    mocks.addPayments.mockResolvedValue(undefined);
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Cobrar/ }));
    await waitFor(() => expect(mocks.addPayments).toHaveBeenCalledTimes(1));
    expect(mocks.payOrder).not.toHaveBeenCalled();
  });
});

describe('ReversePaymentDialog', () => {
  const renderDialog = () =>
    render(<ReversePaymentDialog order={orderFixture()} payment={payment()} onClose={vi.fn()} />);

  it('valida el motivo (5 a 500 caracteres) antes de reversar', async () => {
    renderDialog();
    const submit = screen.getByRole('button', { name: 'Reversar pago' });
    const reason = screen.getByLabelText('Motivo del reverso');
    expect(submit).toBeDisabled();
    fireEvent.change(reason, { target: { value: 'ab' } });
    fireEvent.blur(reason);
    expect(screen.getByRole('alert')).toHaveTextContent(/al menos 5/);
    expect(submit).toBeDisabled();
    fireEvent.change(reason, { target: { value: '  cobro duplicado  ' } });
    expect(submit).not.toBeDisabled();

    mocks.reversePayment.mockResolvedValue({ orderId: 'o1', isPaid: false, payments: [] });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.reversePayment).toHaveBeenCalledTimes(1));
    expect(mocks.reversePayment.mock.calls[0][0]).toEqual({
      orderId: 'o1',
      paymentId: 'pay1',
      reason: 'cobro duplicado',
    });
  });
});

describe('RefundDialog', () => {
  const order = orderFixture({
    payments: [payment({ amount: 30000 }), payment({ id: 'pay2', amount: 20000 })],
  });

  it('limita el valor a lo devolvible y exige motivo', async () => {
    render(<RefundDialog order={order} paymentMethods={METHODS} onClose={vi.fn()} />);
    const amount = screen.getByLabelText('Valor a devolver') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: '999999' } });
    expect(amount.value).toBe('50.000');

    const submit = screen.getByRole('button', { name: /Devolver/ });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'producto dañado' } });
    expect(submit).not.toBeDisabled();

    mocks.refund.mockResolvedValue({ orderId: 'o1', refund: {}, refunds: [] });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.refund).toHaveBeenCalledTimes(1));
    expect(mocks.refund.mock.calls[0][0]).toEqual({
      orderId: 'o1',
      paymentMethodId: 'pm-efectivo',
      amount: 50000,
      reason: 'producto dañado',
    });
  });
});

describe('OrderPaymentsList', () => {
  const baseProps = {
    restaurantId: 'r1',
    paymentMethods: METHODS,
    canMarkPaid: true,
    canReverse: true,
    onRemoveLegacy: vi.fn(),
  };

  it('sin caja: "Anular pago" de siempre', () => {
    const onRemoveLegacy = vi.fn();
    render(
      <OrderPaymentsList
        {...baseProps}
        onRemoveLegacy={onRemoveLegacy}
        cashEnabled={false}
        order={orderFixture({ payments: [payment()] })}
      />
    );
    fireEvent.click(screen.getByLabelText('Anular pago'));
    expect(onRemoveLegacy).toHaveBeenCalledWith('pay1');
    expect(screen.queryByLabelText('Reversar pago')).toBeNull();
  });

  it('con caja: reversar, pago reversado tachado con motivo, pago heredado y devoluciones', () => {
    const order = orderFixture({
      payments: [
        payment({ id: 'ok', amount: 20000 }),
        payment({
          id: 'rev',
          amount: 10000,
          reversedAt: '2026-03-10T16:00:00.000Z',
          reversedBy: 'sup1',
          reversalReason: 'cobro duplicado',
        }),
        payment({ id: 'old', amount: 5000, movementId: undefined }),
      ],
      refunds: [
        {
          id: 'rf1',
          movementId: 'm9',
          amount: 3000,
          methodType: 'efectivo',
          reason: 'producto frío',
          refundedAt: '2026-03-10T17:00:00.000Z',
          refundedBy: 'sup1',
        },
      ],
    });
    render(<OrderPaymentsList {...baseProps} cashEnabled order={order} />);

    // Solo el pago con movimiento se puede reversar
    expect(screen.getAllByLabelText('Reversar pago')).toHaveLength(1);
    expect(screen.queryByLabelText('Anular pago')).toBeNull();
    const reversed = screen.getByTestId('reversed-payment');
    expect(reversed).toHaveTextContent('cobro duplicado');
    expect(reversed).toHaveTextContent('sup1');
    expect(reversed.querySelector('.line-through')).not.toBeNull();
    expect(screen.getByText(/Pago anterior al módulo de caja/)).toBeInTheDocument();
    expect(screen.getByTestId('refund-row')).toHaveTextContent('producto frío');
    expect(screen.getByRole('button', { name: /Devolución/ })).toBeInTheDocument();
  });

  it('sin cash.reverse no hay reverso ni devolución', () => {
    render(
      <OrderPaymentsList
        {...baseProps}
        canReverse={false}
        cashEnabled
        order={orderFixture({ payments: [payment()] })}
      />
    );
    expect(screen.queryByLabelText('Reversar pago')).toBeNull();
    expect(screen.queryByRole('button', { name: /Devolución/ })).toBeNull();
  });
});
