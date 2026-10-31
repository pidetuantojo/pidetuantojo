import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { METHODS, orderFixture } from './orderFixture';

const flags = vi.hoisted(() => ({ cashEnabled: false }));

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { uid: 'u1', restaurantId: 'r1' }, can: () => true }),
}));
vi.mock('@/features/cash/hooks/useCashModule', () => ({
  useCashModule: () => ({ enabled: flags.cashEnabled }),
}));
vi.mock('@/features/orders/services/orders.service', () => ({ ordersService: {} }));
vi.mock('@/features/orders/hooks/useUpdateOrderStatus', () => ({
  useUpdateOrderStatus: () => ({
    updateStatus: vi.fn(),
    isPending: false,
    error: null,
    waError: null,
    clearWaError: vi.fn(),
    notifyPaid: vi.fn(),
  }),
}));
vi.mock('@/lib/whatsapp/useWaConfig', () => ({ useWaConfig: () => ({ autoNotify: false }) }));
vi.mock('@/features/printers/components/PrintOrderButton', () => ({
  PrintOrderButton: () => null,
}));

import { OrderDrawer } from '@/features/orders/components/OrderDrawer';

const renderDrawer = () =>
  render(
    <OrderDrawer
      order={orderFixture({ isPaid: false })}
      orders={[]}
      statuses={[]}
      restaurantId="r1"
      domiciliarios={[]}
      mesas={[]}
      paymentMethods={METHODS}
      canDelete={false}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />
  );

beforeEach(() => {
  flags.cashEnabled = false;
});

describe('OrderDrawer: interruptor manual de pago', () => {
  it('sin caja activa se puede marcar pagado/pendiente', () => {
    renderDrawer();
    expect(screen.getByTitle('Marcar pagado / pendiente')).toBeInTheDocument();
  });

  it('con caja activa el interruptor isPaid no existe (solo la etiqueta)', () => {
    flags.cashEnabled = true;
    renderDrawer();
    expect(screen.queryByTitle('Marcar pagado / pendiente')).toBeNull();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });
});
