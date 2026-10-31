// Máquina de estados del turno y decisión de cierre. Puro.
import type { Money } from '@/lib/shared/money';

import { CashError } from './cash.errors';
import type { ShiftStatus } from './cash.types';

export const SHIFT_TRANSITIONS: Record<ShiftStatus, readonly ShiftStatus[]> = {
  ABIERTO: ['EN_CIERRE', 'CERRADO_PENDIENTE_APROBACION', 'CERRADO'],
  EN_CIERRE: ['CERRADO_PENDIENTE_APROBACION', 'CERRADO'],
  CERRADO_PENDIENTE_APROBACION: ['CERRADO'],
  CERRADO: [],
};

export function canTransition(from: ShiftStatus, to: ShiftStatus): boolean {
  return SHIFT_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ShiftStatus, to: ShiftStatus): void {
  if (!canTransition(from, to)) {
    throw new CashError('INVALID_SHIFT_STATE', `El turno no puede pasar de ${from} a ${to}`);
  }
}

export type CloseDecision = 'AUTO' | 'APPROVAL';

/** Dentro del umbral (inclusive) el cierre es automático; fuera, requiere aprobación. */
export function decideClose(cashDifference: Money, diffThreshold: Money): CloseDecision {
  return Math.abs(cashDifference) <= diffThreshold ? 'AUTO' : 'APPROVAL';
}

/** El turno sigue ocupando la caja y al cajero mientras no esté CERRADO. */
export const isActiveShift = (status: ShiftStatus) => status !== 'CERRADO';
