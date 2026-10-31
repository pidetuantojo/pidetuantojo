'use client';

import { formatMoneyInput, parseMoneyInput } from '../../helpers/money-input.helpers';

import type { MoneyInputProps } from './MoneyInput.types';

/** Campo de pesos COP: solo dígitos, se ve formateado ("15.000") y emite siempre enteros. */
export function MoneyInput({
  value,
  onChange,
  id,
  label,
  placeholder = '0',
  error,
  disabled,
  autoFocus,
  'aria-label': ariaLabel,
}: MoneyInputProps) {
  function handleChange(raw: string) {
    const parsed = parseMoneyInput(raw);
    // Fuera del rango seguro se ignora la tecla: el valor anterior se conserva
    if (parsed.ok) onChange(parsed.value);
  }

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-[var(--t-text-2)]">
          {label}
        </label>
      )}
      <div
        className={`flex items-center gap-1.5 rounded-xl border bg-[var(--t-input-bg)] px-3 py-2 focus-within:border-[#FF6A1A] ${
          error ? 'border-red-400' : 'border-[var(--t-input-border)]'
        }`}
      >
        <span className="text-sm text-[var(--t-text-4)]">$</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          value={formatMoneyInput(value)}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(event) => handleChange(event.target.value)}
          className="w-full bg-transparent text-sm font-bold tabular-nums text-[var(--t-text-1)] placeholder-[var(--t-text-4)] outline-none disabled:opacity-60"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
