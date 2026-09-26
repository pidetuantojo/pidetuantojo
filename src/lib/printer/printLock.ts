import type { Order, PrintJob, PrintStation } from '@/types';

// Si una impresión quedó "colgada" (pestaña cerrada a mitad), se libera el candado después de este tiempo
export const PRINT_LOCK_MS = 30_000;
// Un pedido en cola bloquea nuevos envíos este tiempo; pasado, se puede reintentar (el trabajo viejo se descarta)
export const QUEUE_LOCK_MS = 2 * 60_000;
// Un trabajo tomado por una estación que no terminó (pestaña cerrada) se puede volver a tomar después de esto
export const STALE_CLAIM_MS = 60_000;
// La estación manda latido cada 30 s; los navegadores frenan timers en pestañas de fondo (hasta 1/min)
export const STATION_TIMEOUT_MS = 150_000;

export class PrintInProgressError extends Error {
  constructor() {
    super('Este pedido ya se está imprimiendo.');
    this.name = 'PrintInProgressError';
  }
}

const elapsed = (iso: string | undefined, now: number) => (iso ? now - new Date(iso).getTime() : Infinity);

/** true si el pedido ya está en cola o imprimiéndose (doble click, otro equipo) y el candado no venció. */
export function isPrintLocked(
  data: Pick<Order, 'printStatus' | 'printingStartedAt' | 'printQueuedAt'>,
  now = Date.now()
): boolean {
  if (data.printStatus === 'printing') return elapsed(data.printingStartedAt, now) < PRINT_LOCK_MS;
  if (data.printStatus === 'queued') return elapsed(data.printQueuedAt, now) < QUEUE_LOCK_MS;
  return false;
}

export type JobAction = 'claim' | 'supersede' | 'orphan' | 'skip';

/**
 * Qué hace la estación con un trabajo de la cola:
 * - claim: imprimirlo (pendiente, o tomado por una estación que se cayó)
 * - supersede: hay un trabajo más nuevo para el mismo pedido → no imprimir (evita duplicados)
 * - orphan: el pedido ya no existe
 * - skip: otra estación lo está imprimiendo ahora
 */
export function resolveJobAction(
  job: Pick<PrintJob, 'id' | 'status' | 'claimedAt'>,
  order: Pick<Order, 'printJobId'> | null,
  now = Date.now()
): JobAction {
  if (!order) return 'orphan';
  if (order.printJobId && order.printJobId !== job.id) return 'supersede';
  if (job.status === 'pending') return 'claim';
  if (job.status === 'printing' && elapsed(job.claimedAt, now) > STALE_CLAIM_MS) return 'claim';
  return 'skip';
}

/** true si la estación de impresión mandó latido hace poco. */
export function isStationOnline(station: Pick<PrintStation, 'lastSeenAt'> | null | undefined, now = Date.now()): boolean {
  return !!station && elapsed(station.lastSeenAt, now) < STATION_TIMEOUT_MS;
}
