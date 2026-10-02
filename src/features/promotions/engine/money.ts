// Redondeo de pesos: en Colombia no se cobran $15. Los descuentos en % se redondean a $50.
export const COP_ROUNDING = 50;

export function roundCop(amount: number): number {
  return Math.round(amount / COP_ROUNDING) * COP_ROUNDING;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** "$15.000" (sin el espacio que mete Intl entre "$" y el número). */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
    .format(amount)
    .replace(/\s/g, '');
}
