// Reglas puras de los movimientos de caja: dirección, consecutivo, evento contable y reversibilidad.
import type { AccountingEvent } from '@/lib/ledger/ledger.types';

import { CashError } from './cash.errors';
import type {
  CashMovement,
  CashRegister,
  CashShift,
  MovementDirection,
  MovementType,
  ShiftStatus,
} from './cash.types';

export type SequenceFamily = 'RC' | 'CE' | 'TR' | 'RV';

interface MovementMeta {
  /** null = depende del movimiento original (reverso). */
  direction: MovementDirection | null;
  family: SequenceFamily;
  /** Evento contable; null = el asiento sale de la reversión del original. */
  event: AccountingEvent | null;
  /** Estados del turno en los que se admite crear este movimiento. */
  shiftStatuses: readonly ShiftStatus[];
}

const OPEN: readonly ShiftStatus[] = ['ABIERTO'];
const CLOSING_PHASE: readonly ShiftStatus[] = [
  'ABIERTO',
  'EN_CIERRE',
  'CERRADO_PENDIENTE_APROBACION',
];

export const MOVEMENT_META: Record<MovementType, MovementMeta> = {
  VENTA: { direction: 'IN', family: 'RC', event: 'SALE', shiftStatuses: OPEN },
  INGRESO_VARIO: { direction: 'IN', family: 'RC', event: 'OTHER_INCOME', shiftStatuses: OPEN },
  AJUSTE_SOBRANTE: {
    direction: 'IN',
    family: 'RC',
    event: 'CASH_SURPLUS',
    shiftStatuses: CLOSING_PHASE,
  },
  DEVOLUCION: { direction: 'OUT', family: 'CE', event: 'REFUND', shiftStatuses: OPEN },
  EGRESO: { direction: 'OUT', family: 'CE', event: 'EXPENSE', shiftStatuses: OPEN },
  AJUSTE_FALTANTE: {
    direction: 'OUT',
    family: 'CE',
    event: 'CASH_SHORTAGE',
    shiftStatuses: CLOSING_PHASE,
  },
  RETIRO_PARCIAL: { direction: 'OUT', family: 'TR', event: 'CASH_TRANSFER', shiftStatuses: OPEN },
  BASE_APERTURA: { direction: 'IN', family: 'TR', event: 'CASH_TRANSFER', shiftStatuses: OPEN },
  TRASLADO_CIERRE: {
    direction: 'OUT',
    family: 'TR',
    event: 'CASH_TRANSFER',
    shiftStatuses: CLOSING_PHASE,
  },
  CONSIGNACION: { direction: 'OUT', family: 'TR', event: 'BANK_DEPOSIT', shiftStatuses: [] },
  REVERSO: { direction: null, family: 'RV', event: null, shiftStatuses: ['ABIERTO', 'EN_CIERRE'] },
};

export const REVERSIBLE_TYPES: readonly MovementType[] = [
  'VENTA',
  'DEVOLUCION',
  'INGRESO_VARIO',
  'EGRESO',
  'RETIRO_PARCIAL',
];

/** Movimientos que mueven efectivo entre dos cajas (usan CASH_TRANSFER). */
export const TRANSFER_TYPES: readonly MovementType[] = [
  'RETIRO_PARCIAL',
  'BASE_APERTURA',
  'TRASLADO_CIERRE',
];

export function oppositeDirection(direction: MovementDirection): MovementDirection {
  return direction === 'IN' ? 'OUT' : 'IN';
}

/**
 * Un movimiento solo se puede reversar si está aplicado, es de un tipo reversible, no fue
 * reversado y su turno sigue sin cerrarse (después se corrige con una DEVOLUCION).
 */
export function assertReversible(
  movement: Pick<CashMovement, 'status' | 'type' | 'reversedByMovementId' | 'mirrorOfMovementId'>,
  shift: Pick<CashShift, 'status'> | null
): void {
  if (movement.reversedByMovementId) {
    throw new CashError('ALREADY_REVERSED', 'El movimiento ya fue reversado');
  }
  if (movement.mirrorOfMovementId) {
    throw new CashError(
      'NOT_REVERSIBLE',
      'El espejo de un traslado se reversa desde el traslado original'
    );
  }
  if (movement.status !== 'APLICADO') {
    throw new CashError('NOT_REVERSIBLE', 'Solo se reversan movimientos aplicados');
  }
  if (!REVERSIBLE_TYPES.includes(movement.type)) {
    throw new CashError('NOT_REVERSIBLE', 'Este tipo de movimiento no se puede reversar');
  }
  if (shift && (shift.status === 'CERRADO' || shift.status === 'CERRADO_PENDIENTE_APROBACION')) {
    throw new CashError(
      'SHIFT_CLOSED',
      'El turno ya cerró: registra una devolución en lugar de reversar'
    );
  }
}

/**
 * Política de turno: las registradoras siempre exigen turno; en cajas sin turno (general/menor)
 * las ventas y devoluciones en efectivo siguen necesitando el turno de quien cobra.
 */
export function assertShiftPolicy(
  input: Pick<CashMovement, 'type' | 'methodType' | 'shiftId'>,
  register: Pick<CashRegister, 'type'>
): void {
  if (input.shiftId) return;
  if (register.type === 'REGISTRADORA') {
    throw new CashError('SHIFT_REQUIRED', 'Las cajas registradoras exigen un turno abierto');
  }
  const cashSale = input.type === 'VENTA' || input.type === 'DEVOLUCION';
  if (cashSale && input.methodType === 'efectivo') {
    throw new CashError('SHIFT_REQUIRED', 'Los pagos en efectivo exigen tu turno abierto');
  }
}

/** Tipos que, ya aplicados, se reflejan también como movimiento espejo en la caja contraparte. */
export function needsMirror(
  input: Pick<CashMovement, 'type' | 'status'>,
  reverses?: Pick<CashMovement, 'transferId'>
): boolean {
  if (input.status !== 'APLICADO') return false;
  if (input.type === 'REVERSO') return Boolean(reverses?.transferId);
  return TRANSFER_TYPES.includes(input.type);
}
