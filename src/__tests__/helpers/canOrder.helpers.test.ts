import { describe, it, expect } from 'vitest';
import { checkCanOrder } from '@/features/menu/helpers/canOrder.helpers';
import type { CartItem } from '@/store/cart.store';
import type { DeliveryType, PaymentMethod } from '@/features/menu/helpers/whatsapp.helpers';

const ITEM: CartItem = {
  cartId: 'c1',
  productId: 'p1',
  productName: 'Burger',
  quantity: 1,
  unitPrice: 10000,
  subtotal: 10000,
  additionals: [],
  specialInstructions: '',
};

function base(overrides: Record<string, unknown> = {}) {
  return {
    items: [ITEM],
    name: 'Juan Pérez',
    phone: '3001234567',
    deliveryType: 'recoger' as DeliveryType,
    paymentMethod: 'efectivo' as PaymentMethod,
    address: '',
    isZonesMode: false,
    selectedZoneId: '',
    barrio: '',
    ...overrides,
  };
}

describe('checkCanOrder — recoger en tienda', () => {
  it('permite pedido válido para recoger', () => {
    expect(checkCanOrder(base())).toBe(true);
  });

  it('rechaza si el carrito está vacío', () => {
    expect(checkCanOrder(base({ items: [] }))).toBe(false);
  });

  it('rechaza si falta el nombre del cliente', () => {
    expect(checkCanOrder(base({ name: '' }))).toBe(false);
  });

  it('rechaza si el nombre es solo espacios', () => {
    expect(checkCanOrder(base({ name: '   ' }))).toBe(false);
  });

  it('rechaza si falta el teléfono', () => {
    expect(checkCanOrder(base({ phone: '' }))).toBe(false);
  });

  it('rechaza si no se eligió tipo de entrega', () => {
    expect(checkCanOrder(base({ deliveryType: '' as DeliveryType }))).toBe(false);
  });

  it('rechaza si no se eligió método de pago', () => {
    expect(checkCanOrder(base({ paymentMethod: '' as PaymentMethod }))).toBe(false);
  });

  it('acepta transferencia como método de pago', () => {
    expect(checkCanOrder(base({ paymentMethod: 'transferencia' as PaymentMethod }))).toBe(true);
  });
});

describe('checkCanOrder — domicilio modo manual (barrio libre)', () => {
  const DELIVERY_BASE = base({
    deliveryType: 'domicilio' as DeliveryType,
    address: 'Calle 123 #45-67',
    barrio: 'Chapinero',
    isZonesMode: false,
  });

  it('permite pedido válido a domicilio con dirección y barrio', () => {
    expect(checkCanOrder(DELIVERY_BASE)).toBe(true);
  });

  it('rechaza si falta la dirección', () => {
    expect(checkCanOrder({ ...DELIVERY_BASE, address: '' })).toBe(false);
  });

  it('rechaza si la dirección es solo espacios', () => {
    expect(checkCanOrder({ ...DELIVERY_BASE, address: '   ' })).toBe(false);
  });

  it('rechaza si falta el barrio en modo manual', () => {
    expect(checkCanOrder({ ...DELIVERY_BASE, barrio: '' })).toBe(false);
  });

  it('rechaza si el barrio es solo espacios', () => {
    expect(checkCanOrder({ ...DELIVERY_BASE, barrio: '   ' })).toBe(false);
  });
});

describe('checkCanOrder — domicilio modo zonas', () => {
  const ZONES_BASE = base({
    deliveryType: 'domicilio' as DeliveryType,
    address: 'Calle 123 #45-67',
    isZonesMode: true,
    selectedZoneId: 'zone-norte',
    barrio: '',
  });

  it('permite pedido válido con zona seleccionada', () => {
    expect(checkCanOrder(ZONES_BASE)).toBe(true);
  });

  it('rechaza si no se seleccionó ninguna zona', () => {
    expect(checkCanOrder({ ...ZONES_BASE, selectedZoneId: '' })).toBe(false);
  });

  it('rechaza si falta la dirección en modo zonas', () => {
    expect(checkCanOrder({ ...ZONES_BASE, address: '' })).toBe(false);
  });

  it('NO requiere barrio en modo zonas (la zona lo reemplaza)', () => {
    expect(checkCanOrder({ ...ZONES_BASE, barrio: '' })).toBe(true);
  });

  it('acepta pedido aunque haya barrio en modo zonas', () => {
    expect(checkCanOrder({ ...ZONES_BASE, barrio: 'Cualquier barrio' })).toBe(true);
  });
});

describe('checkCanOrder — casos extremos', () => {
  it('acepta con múltiples items en el carrito', () => {
    const items: CartItem[] = [
      ITEM,
      { ...ITEM, cartId: 'c2', productId: 'p2', productName: 'Pizza', subtotal: 20000 },
    ];
    expect(checkCanOrder(base({ items }))).toBe(true);
  });

  it('rechaza si solo hay espacios en el teléfono', () => {
    expect(checkCanOrder(base({ phone: '   ' }))).toBe(false);
  });
});
