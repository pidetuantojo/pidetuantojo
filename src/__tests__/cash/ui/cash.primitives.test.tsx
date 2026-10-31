import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { DenominationCounter } from '@/features/cash/components/DenominationCounter';
import { MoneyInput } from '@/features/cash/components/MoneyInput';
import { countTotal, parseQuantity, setQuantity } from '@/features/cash/helpers/count.helpers';
import { formatMoneyInput, parseMoneyInput } from '@/features/cash/helpers/money-input.helpers';
import { reasonError } from '@/features/cash/helpers/reason.helpers';
import { DEFAULT_DENOMINATIONS } from '@/lib/cash/denominations.helpers';
import type { CountMap } from '@/lib/cash/cash.types';
import type { Money } from '@/lib/shared/money';

function MoneyHarness({ onValue }: { onValue: (v: Money | null) => void }) {
  const [value, setValue] = useState<Money | null>(null);
  return (
    <MoneyInput
      aria-label="Monto"
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

describe('parseMoneyInput / formatMoneyInput (puros)', () => {
  it('solo dígitos: quita $, puntos, comas, espacios y letras', () => {
    expect(parseMoneyInput('$ 15.000')).toEqual({ ok: true, value: 15000 });
    expect(parseMoneyInput('1,500')).toEqual({ ok: true, value: 1500 });
    expect(parseMoneyInput('abc')).toEqual({ ok: true, value: null });
    expect(parseMoneyInput('007')).toEqual({ ok: true, value: 7 });
    expect(parseMoneyInput('')).toEqual({ ok: true, value: null });
  });

  it('rechaza lo que no es un entero seguro', () => {
    expect(parseMoneyInput('9007199254740991')).toEqual({ ok: true, value: 9007199254740991 });
    expect(parseMoneyInput('9007199254740992')).toEqual({ ok: false });
    expect(parseMoneyInput('1'.repeat(20))).toEqual({ ok: false });
  });

  it('formatea con puntos de miles', () => {
    expect(formatMoneyInput(1234567)).toBe('1.234.567');
    expect(formatMoneyInput(0)).toBe('0');
    expect(formatMoneyInput(null)).toBe('');
  });
});

describe('MoneyInput', () => {
  it('ignora letras y emite null mientras no haya dígitos', () => {
    const onValue = vi.fn();
    render(<MoneyHarness onValue={onValue} />);
    const input = screen.getByLabelText('Monto') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('');
    expect(onValue).toHaveBeenLastCalledWith(null);
  });

  it('formatea mientras se escribe y emite enteros (los decimales no existen)', () => {
    const onValue = vi.fn();
    render(<MoneyHarness onValue={onValue} />);
    const input = screen.getByLabelText('Monto') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '15000' } });
    expect(input.value).toBe('15.000');
    expect(onValue).toHaveBeenLastCalledWith(15000);
    fireEvent.change(input, { target: { value: '12,5' } });
    const last = onValue.mock.calls.at(-1)?.[0] as number;
    expect(Number.isInteger(last)).toBe(true);
    expect(last).toBe(125);
  });

  it('no acepta valores fuera del rango seguro: conserva el anterior', () => {
    const onValue = vi.fn();
    render(<MoneyHarness onValue={onValue} />);
    const input = screen.getByLabelText('Monto') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9007199254740991' } });
    onValue.mockClear();
    fireEvent.change(input, { target: { value: '90071992547409910' } });
    expect(onValue).not.toHaveBeenCalled();
    expect(input.value).toBe('9.007.199.254.740.991');
  });
});

describe('conteo de denominaciones', () => {
  it('countTotal suma por denominación e ignora llaves desconocidas', () => {
    const count: CountMap = { BILLETE_100000: 2, MONEDA_500: 3, FANTASMA: 9 };
    expect(countTotal(count, DEFAULT_DENOMINATIONS)).toBe(201500);
  });

  it('parseQuantity y setQuantity: enteros no negativos y conteo compacto', () => {
    expect(parseQuantity('1a2')).toBe(12);
    expect(parseQuantity('')).toBe(0);
    expect(parseQuantity('-5')).toBe(5);
    expect(setQuantity({ BILLETE_5000: 1 }, 'BILLETE_5000', 0)).toEqual({});
  });
});

function CounterHarness({ hideTotal }: { hideTotal?: boolean }) {
  const [value, setValue] = useState<CountMap>({});
  return (
    <DenominationCounter
      denominations={DEFAULT_DENOMINATIONS}
      value={value}
      onChange={setValue}
      hideTotal={hideTotal}
    />
  );
}

describe('DenominationCounter', () => {
  it('muestra subtotal por fila y total del conteo', () => {
    render(<CounterHarness />);
    const bill = screen.getByLabelText(/Cantidad de Billete de .*100\.000/);
    fireEvent.change(bill, { target: { value: '2' } });
    const coin = screen.getByLabelText(/Cantidad de Moneda de .*500/);
    fireEvent.change(coin, { target: { value: '3' } });
    expect(screen.getByTestId('subtotal-BILLETE_100000')).toHaveTextContent('200.000');
    expect(screen.getByTestId('subtotal-MONEDA_500')).toHaveTextContent('1.500');
    expect(screen.getByTestId('count-total')).toHaveTextContent('201.500');
  });

  it('solo acepta enteros no negativos', () => {
    render(<CounterHarness />);
    const bill = screen.getByLabelText(/Cantidad de Billete de .*10\.000/) as HTMLInputElement;
    fireEvent.change(bill, { target: { value: '-3.7' } });
    expect(bill.value).toBe('37');
  });

  it('hideTotal oculta el total del conteo', () => {
    render(<CounterHarness hideTotal />);
    expect(screen.queryByTestId('count-total')).toBeNull();
  });
});

describe('reasonError', () => {
  it('exige entre 5 y 500 caracteres sin contar espacios sobrantes', () => {
    expect(reasonError('   ab   ')).toMatch(/al menos 5/);
    expect(reasonError('error de digitación')).toBeNull();
    expect(reasonError('x'.repeat(501))).toMatch(/500/);
  });
});
