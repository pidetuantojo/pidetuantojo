import { describe, it, expect } from 'vitest';

import { buildDriverMessage, toAssignedDriver, validateCourierName } from '@/features/orders/helpers/driver.helpers';
import type { Domiciliario, Order } from '@/types';

const INDIVIDUAL: Domiciliario = {
  id: 'd1', restaurantId: 'r1', name: 'Juan Pérez', code: 'D-01', phone: '3001112233',
  isActive: true, createdAt: '', updatedAt: '',
};

const COMPANY: Domiciliario = {
  id: 'e1', restaurantId: 'r1', name: 'Domicilios Express', phone: '3009998877',
  isCompany: true, isActive: true, createdAt: '', updatedAt: '',
};

const ORDER: Order = {
  id: 'o1', restaurantId: 'r1', orderNumber: '#379379',
  customerName: 'Jesus', customerPhone: '3007581655',
  customerAddress: 'Calle 10 #19-06', barrio: 'Paraiso',
  deliveryType: 'domicilio', paymentMethod: 'Efectivo', paymentMethodType: 'efectivo',
  items: [], subtotal: 35000, total: 35000, statusId: 's1', createdAt: '', updatedAt: '',
};

describe('validateCourierName', () => {
  it('no aplica a domiciliarios individuales', () => {
    expect(validateCourierName(INDIVIDUAL, '')).toBeNull();
  });

  it('es obligatorio para empresas', () => {
    expect(validateCourierName(COMPANY, '   ')).toMatch(/domiciliario/);
    expect(validateCourierName(COMPANY, 'Carlos D-07')).toBeNull();
  });
});

describe('toAssignedDriver', () => {
  it('individual: guarda código y no marca empresa', () => {
    expect(toAssignedDriver(INDIVIDUAL)).toEqual({ id: 'd1', name: 'Juan Pérez', phone: '3001112233', code: 'D-01' });
  });

  it('empresa: guarda quién tomó el pedido y no deja campos undefined', () => {
    const assigned = toAssignedDriver(COMPANY, '  Carlos D-07 ');
    expect(assigned).toEqual({
      id: 'e1', name: 'Domicilios Express', phone: '3009998877', isCompany: true, courierName: 'Carlos D-07',
    });
    expect(Object.values(assigned)).not.toContain(undefined);
  });
});

describe('buildDriverMessage', () => {
  it('empresa: incluye el domiciliario indicado', () => {
    const msg = buildDriverMessage(
      { ...ORDER, assignedDriver: toAssignedDriver(COMPANY, 'Carlos D-07') },
      { isPaid: false, grandTotal: 55000 },
    );
    expect(msg).toContain('*Domiciliario:* Carlos D-07');
    expect(msg).toContain('*Cobrar:* $55.000');
  });

  it('individual: no agrega línea de domiciliario', () => {
    const msg = buildDriverMessage({ ...ORDER, assignedDriver: toAssignedDriver(INDIVIDUAL) }, { isPaid: false, grandTotal: 55000 });
    expect(msg).not.toContain('*Domiciliario:*');
  });

  it('transferencia pagada (ej. Nequi): no pide cobrar', () => {
    const msg = buildDriverMessage(
      { ...ORDER, paymentMethod: 'Nequi', paymentMethodType: 'nequi' },
      { isPaid: true, grandTotal: 55000 },
    );
    expect(msg).toContain('*Pago:* Nequi ✅');
    expect(msg).not.toContain('Cobrar');
  });
});
