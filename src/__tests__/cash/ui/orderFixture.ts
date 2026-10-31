import type { Order, OrderPayment, PaymentMethodConfig } from '@/types';

export const METHODS: PaymentMethodConfig[] = [
  { id: 'pm-efectivo', type: 'efectivo', isActive: true },
  { id: 'pm-nequi', type: 'nequi', isActive: true, account: '3001234567' },
];

export const payment = (overrides: Partial<OrderPayment> = {}): OrderPayment => ({
  id: 'pay1',
  amount: 30000,
  method: 'Efectivo',
  methodType: 'efectivo',
  paidAt: '2026-03-10T15:00:00.000Z',
  paymentMethodId: 'pm-efectivo',
  movementId: 'mov1',
  ...overrides,
});

export const orderFixture = (overrides: Partial<Order> = {}): Order => ({
  id: 'o1',
  restaurantId: 'r1',
  orderNumber: 'A-100',
  customerName: 'Cliente Ficticio',
  customerPhone: '3000000000',
  paymentMethod: 'Efectivo',
  items: [],
  subtotal: 50000,
  discount: 0,
  deliveryFee: 0,
  total: 50000,
  statusId: 'st-new',
  deliveryType: 'recoger',
  createdAt: '2026-03-10T14:00:00.000Z',
  updatedAt: '2026-03-10T14:00:00.000Z',
  ...overrides,
});
