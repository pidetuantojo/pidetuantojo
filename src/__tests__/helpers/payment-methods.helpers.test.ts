import { describe, it, expect } from 'vitest';

import {
  getActivePaymentMethods,
  getPaymentLabel,
  normalizeAccount,
  toOrderPayment,
  validatePaymentAccount,
} from '@/features/payment-methods/helpers/payment-methods.helpers';

describe('validatePaymentAccount', () => {
  it('efectivo y datáfono no requieren datos', () => {
    expect(validatePaymentAccount('efectivo', '')).toBeNull();
    expect(validatePaymentAccount('datafono', '')).toBeNull();
  });

  it('Nequi / Daviplata: celular de 10 dígitos que empieza por 3', () => {
    expect(validatePaymentAccount('nequi', '3007581655')).toBeNull();
    expect(validatePaymentAccount('daviplata', '300 758 1655')).toBeNull();
    expect(validatePaymentAccount('nequi', '')).toBeNull(); // la cuenta es opcional
    expect(validatePaymentAccount('nequi', '2007581655')).toMatch(/10 dígitos/);
    expect(validatePaymentAccount('daviplata', '300758165')).toMatch(/10 dígitos/);
  });

  it('BreB: alias con @ o número', () => {
    expect(validatePaymentAccount('breb', '@jesusita546')).toBeNull();
    expect(validatePaymentAccount('breb', '3007581655')).toBeNull();
    expect(validatePaymentAccount('breb', 'jesusita546')).toMatch(/@/);
    expect(validatePaymentAccount('breb', '@ab')).toMatch(/@/);
  });

  it('Bancolombia: 11 dígitos', () => {
    expect(validatePaymentAccount('bancolombia', '86344499677')).toBeNull();
    expect(validatePaymentAccount('bancolombia', '863-444996-77')).toBeNull();
    expect(validatePaymentAccount('bancolombia', '8634449967')).toMatch(/11 dígitos/);
  });

  it('Otro banco: requiere nombre; la cuenta es opcional pero de 6 a 20 dígitos', () => {
    expect(validatePaymentAccount('otro_banco', '', 'Davivienda')).toBeNull();
    expect(validatePaymentAccount('otro_banco', '123456789', 'Davivienda')).toBeNull();
    expect(validatePaymentAccount('otro_banco', '123456789', '')).toMatch(/banco/);
    expect(validatePaymentAccount('otro_banco', '123', 'Davivienda')).toMatch(/entre 6 y 20/);
  });
});

describe('normalizeAccount', () => {
  it('quita espacios, guiones y puntos de números', () => {
    expect(normalizeAccount('bancolombia', ' 863-444.996 77 ')).toBe('86344499677');
  });

  it('conserva el alias BreB', () => {
    expect(normalizeAccount('breb', ' @jesusita.546 ')).toBe('@jesusita.546');
  });
});

describe('getActivePaymentMethods', () => {
  it('sin configuración ofrece solo efectivo', () => {
    expect(getActivePaymentMethods(undefined).map((m) => m.type)).toEqual(['efectivo']);
    expect(getActivePaymentMethods([]).map((m) => m.type)).toEqual(['efectivo']);
  });

  it('filtra los inactivos y permite varias cuentas', () => {
    const active = getActivePaymentMethods([
      { id: '1', type: 'efectivo', isActive: false },
      { id: '2', type: 'nequi', isActive: true, account: '3007581655' },
      { id: '3', type: 'nequi', isActive: true, account: '3001112233' },
    ]);
    expect(active.map((m) => m.id)).toEqual(['2', '3']);
  });
});

describe('getPaymentLabel / toOrderPayment', () => {
  it('usa el nombre del banco para "otro banco"', () => {
    expect(getPaymentLabel({ type: 'otro_banco', bankName: 'Davivienda' })).toBe('Davivienda');
    expect(getPaymentLabel({ type: 'bancolombia' })).toBe('Bancolombia');
  });

  it('no incluye paymentAccount cuando el método no tiene cuenta', () => {
    expect(toOrderPayment({ id: 'e', type: 'efectivo', isActive: true })).toEqual({
      paymentMethod: 'Efectivo',
      paymentMethodType: 'efectivo',
    });
    expect(toOrderPayment({ id: 'n', type: 'nequi', isActive: true, account: '3007581655' })).toEqual({
      paymentMethod: 'Nequi',
      paymentMethodType: 'nequi',
      paymentAccount: '3007581655',
    });
  });
});
