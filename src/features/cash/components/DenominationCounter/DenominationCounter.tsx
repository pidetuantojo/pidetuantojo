'use client';

import { useMemo } from 'react';

import { formatCOP } from '@/lib/shared/money';

import {
  countTotal,
  parseQuantity,
  rowSubtotal,
  setQuantity,
  sortDenominations,
} from '../../helpers/count.helpers';

import type { DenominationCounterProps } from './DenominationCounter.types';

const KIND_LABEL = { BILLETE: 'Billete', MONEDA: 'Moneda' } as const;

/** Conteo de efectivo por billete y moneda, con subtotal por fila y total del conteo. */
export function DenominationCounter({
  denominations,
  value,
  onChange,
  hideTotal = false,
  disabled,
}: DenominationCounterProps) {
  const rows = useMemo(() => sortDenominations(denominations), [denominations]);
  const total = countTotal(value, denominations);

  return (
    <div className="space-y-2">
      <ul className="divide-[var(--t-border)]/60 divide-y">
        {rows.map((denomination) => {
          const quantity = value[denomination.key] ?? 0;
          const label = `${KIND_LABEL[denomination.kind]} de ${formatCOP(denomination.value)}`;
          return (
            <li key={denomination.key} className="flex items-center gap-3 py-1.5">
              <span className="flex-1 text-sm text-[var(--t-text-1)]">{label}</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={`Cantidad de ${label}`}
                disabled={disabled}
                value={quantity === 0 ? '' : String(quantity)}
                placeholder="0"
                onChange={(event) =>
                  onChange(setQuantity(value, denomination.key, parseQuantity(event.target.value)))
                }
                className="w-20 rounded-lg border border-[var(--t-input-border)] bg-[var(--t-input-bg)] px-2 py-1.5 text-right text-sm font-bold tabular-nums text-[var(--t-text-1)] outline-none focus:border-[#FF6A1A] disabled:opacity-60"
              />
              <span
                className="w-28 text-right text-xs tabular-nums text-[var(--t-text-3)]"
                data-testid={`subtotal-${denomination.key}`}
              >
                {formatCOP(rowSubtotal(denomination, quantity))}
              </span>
            </li>
          );
        })}
      </ul>
      {!hideTotal && (
        <div className="flex justify-between border-t border-[var(--t-border)] pt-2 text-sm font-extrabold text-[var(--t-text-1)]">
          <span>Total contado</span>
          <span data-testid="count-total">{formatCOP(total)}</span>
        </div>
      )}
    </div>
  );
}
