import type { Order } from '@/types';

// Si una impresión quedó "colgada" (pestaña cerrada a mitad), se libera el candado después de este tiempo
export const PRINT_LOCK_MS = 30_000;

export class PrintInProgressError extends Error {
  constructor() {
    super('Este pedido ya se está imprimiendo.');
    this.name = 'PrintInProgressError';
  }
}

/** true si otro click/equipo tiene tomado el candado de impresión y todavía no venció. */
export function isPrintLocked(
  data: Pick<Order, 'printStatus' | 'printingStartedAt'>,
  now = Date.now()
): boolean {
  if (data.printStatus !== 'printing' || !data.printingStartedAt) return false;
  return now - new Date(data.printingStartedAt).getTime() < PRINT_LOCK_MS;
}
