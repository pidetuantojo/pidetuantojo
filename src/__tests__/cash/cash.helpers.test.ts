import { describe, expect, it } from 'vitest';

import { CashError } from '@/lib/cash/cash.errors';
import type { CashMovement } from '@/lib/cash/cash.types';
import { computeCountTotal, DEFAULT_DENOMINATIONS } from '@/lib/cash/denominations.helpers';
import {
  computeDifferences,
  computeExpectedByMethod,
  computeExpectedCash,
  type ExpectedInput,
} from '@/lib/cash/expected.helpers';
import { assertReversible, MOVEMENT_META } from '@/lib/cash/movement.helpers';
import { assertTransition, canTransition, decideClose } from '@/lib/cash/shift.helpers';

const mv = (over: Partial<ExpectedInput>): ExpectedInput => ({
  direction: 'IN',
  amount: 1000,
  methodType: 'efectivo',
  status: 'APLICADO',
  ...over,
});

describe('computeCountTotal', () => {
  it('suma valor x cantidad con las denominaciones por defecto', () => {
    expect(
      computeCountTotal(
        { BILLETE_50000: 2, BILLETE_1000: 3, MONEDA_500: 4, MONEDA_50: 1 },
        DEFAULT_DENOMINATIONS
      )
    ).toBe(100000 + 3000 + 2000 + 50);
  });

  it('un conteo vacío vale cero', () => {
    expect(computeCountTotal({}, DEFAULT_DENOMINATIONS)).toBe(0);
  });

  it('rechaza llaves desconocidas, decimales y negativos', () => {
    expect(() => computeCountTotal({ NOPE: 1 }, DEFAULT_DENOMINATIONS)).toThrow(CashError);
    expect(() => computeCountTotal({ BILLETE_1000: 1.5 }, DEFAULT_DENOMINATIONS)).toThrow(
      CashError
    );
    expect(() => computeCountTotal({ BILLETE_1000: -1 }, DEFAULT_DENOMINATIONS)).toThrow(CashError);
  });

  it('rechaza totales que desbordan enteros seguros', () => {
    expect(() =>
      computeCountTotal({ BILLETE_100000: Number.MAX_SAFE_INTEGER }, DEFAULT_DENOMINATIONS)
    ).toThrow(CashError);
  });
});

describe('efectivo esperado', () => {
  it('base + ventas ef. + ingresos ef. - egresos - retiros - devoluciones ef.', () => {
    const base = 100000;
    const ventas = 45000;
    const ingresos = 5000;
    const egresos = 12000;
    const retiros = 30000;
    const devoluciones = 7000;
    const list = [
      mv({ amount: base }),
      mv({ amount: ventas }),
      mv({ amount: ingresos }),
      mv({ direction: 'OUT', amount: egresos }),
      mv({ direction: 'OUT', amount: retiros }),
      mv({ direction: 'OUT', amount: devoluciones }),
    ];
    expect(computeExpectedCash(list)).toBe(
      base + ventas + ingresos - egresos - retiros - devoluciones
    );
  });

  it('un movimiento reversado y su reverso se anulan', () => {
    const list = [
      mv({ amount: 20000 }),
      mv({ amount: 8000 }),
      mv({ direction: 'OUT', amount: 8000 }),
    ];
    expect(computeExpectedCash(list)).toBe(20000);
  });

  it('pendientes y rechazados no cuentan', () => {
    const list = [
      mv({ amount: 10000 }),
      mv({ direction: 'OUT', amount: 4000, status: 'PENDIENTE_APROBACION' }),
      mv({ direction: 'OUT', amount: 3000, status: 'RECHAZADO' }),
    ];
    expect(computeExpectedCash(list)).toBe(10000);
  });

  it('separa por medio de pago y el efectivo es solo efectivo', () => {
    const list = [mv({ amount: 9000 }), mv({ methodType: 'nequi', amount: 15000 })];
    expect(computeExpectedByMethod(list)).toEqual({ efectivo: 9000, nequi: 15000 });
    expect(computeExpectedCash(list)).toBe(9000);
  });

  it('diferencias = declarado - esperado', () => {
    expect(
      computeDifferences({ efectivo: 50000, datafono: 20000 }, { efectivo: 48000, datafono: 21000 })
    ).toEqual({ efectivo: -2000, datafono: 1000 });
  });
});

describe('decisión de cierre y máquina de estados', () => {
  it('dentro del umbral (inclusive) cierra solo; fuera pide aprobación', () => {
    expect(decideClose(0, 0)).toBe('AUTO');
    expect(decideClose(-2000, 2000)).toBe('AUTO');
    expect(decideClose(2000, 2000)).toBe('AUTO');
    expect(decideClose(-2001, 2000)).toBe('APPROVAL');
    expect(decideClose(5000, 0)).toBe('APPROVAL');
  });

  it('transiciones válidas', () => {
    expect(canTransition('ABIERTO', 'EN_CIERRE')).toBe(true);
    expect(canTransition('ABIERTO', 'CERRADO')).toBe(true);
    expect(canTransition('EN_CIERRE', 'CERRADO_PENDIENTE_APROBACION')).toBe(true);
    expect(canTransition('CERRADO_PENDIENTE_APROBACION', 'CERRADO')).toBe(true);
  });

  it('transiciones inválidas lanzan', () => {
    expect(() => assertTransition('CERRADO', 'ABIERTO')).toThrow(CashError);
    expect(() => assertTransition('CERRADO_PENDIENTE_APROBACION', 'EN_CIERRE')).toThrow(CashError);
    expect(() => assertTransition('EN_CIERRE', 'ABIERTO')).toThrow(CashError);
    expect(() => assertTransition('CERRADO', 'CERRADO')).toThrow(CashError);
  });
});

describe('reversibilidad y consecutivos', () => {
  const base: Pick<CashMovement, 'status' | 'type' | 'reversedByMovementId'> = {
    status: 'APLICADO',
    type: 'EGRESO',
  };

  it('permite reversar un movimiento aplicado en un turno abierto', () => {
    expect(() => assertReversible(base, { status: 'ABIERTO' })).not.toThrow();
    expect(() => assertReversible(base, { status: 'EN_CIERRE' })).not.toThrow();
  });

  it('rechaza reversos de reversos, bases, traslados y ajustes', () => {
    (
      ['REVERSO', 'BASE_APERTURA', 'TRASLADO_CIERRE', 'AJUSTE_SOBRANTE', 'AJUSTE_FALTANTE'] as const
    ).forEach((type) => expect(() => assertReversible({ ...base, type }, null)).toThrow(CashError));
  });

  it('rechaza ya reversados, no aplicados y turnos cerrados', () => {
    expect(() => assertReversible({ ...base, reversedByMovementId: 'x' }, null)).toThrow(
      /reversado/
    );
    expect(() => assertReversible({ ...base, status: 'PENDIENTE_APROBACION' }, null)).toThrow(
      CashError
    );
    expect(() => assertReversible(base, { status: 'CERRADO' })).toThrow(/devoluci/);
    expect(() => assertReversible(base, { status: 'CERRADO_PENDIENTE_APROBACION' })).toThrow(
      CashError
    );
  });

  it('familias de consecutivo', () => {
    expect(MOVEMENT_META.INGRESO_VARIO.family).toBe('RC');
    expect(MOVEMENT_META.EGRESO.family).toBe('CE');
    expect(MOVEMENT_META.DEVOLUCION.family).toBe('CE');
    expect(MOVEMENT_META.RETIRO_PARCIAL.family).toBe('TR');
    expect(MOVEMENT_META.BASE_APERTURA.family).toBe('TR');
    expect(MOVEMENT_META.TRASLADO_CIERRE.family).toBe('TR');
    expect(MOVEMENT_META.REVERSO.family).toBe('RV');
  });
});
