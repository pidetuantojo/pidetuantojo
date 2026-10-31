import type { PaymentMethodType } from '@/types';

import type { CashClosing } from '../../types/cash.types';

export interface ClosingRow {
  methodType: PaymentMethodType;
  expected: number;
  declared: number;
  difference: number;
}

/** Una fila por medio de pago presente en el cierre (esperado, declarado y diferencia). */
export function closingRows(closing: CashClosing): ClosingRow[] {
  const types = new Set<PaymentMethodType>([
    ...(Object.keys(closing.expectedByMethod) as PaymentMethodType[]),
    ...(Object.keys(closing.declaredByMethod) as PaymentMethodType[]),
  ]);
  const rows = Array.from(types).map((methodType) => ({
    methodType,
    expected: closing.expectedByMethod[methodType] ?? 0,
    declared: closing.declaredByMethod[methodType] ?? 0,
    difference: closing.differenceByMethod[methodType] ?? 0,
  }));
  // El efectivo siempre primero
  return [
    ...rows.filter((r) => r.methodType === 'efectivo'),
    ...rows.filter((r) => r.methodType !== 'efectivo'),
  ];
}
