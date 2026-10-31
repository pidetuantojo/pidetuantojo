import { REVERSIBLE_TYPES } from '@/lib/cash/movement.helpers';
import type { PaymentMethodType } from '@/types';

import { CashApiError } from '../services/cash.api';
import type { MovementRow, MovementStatus, MovementType, ShiftStatus } from '../types/cash.types';

const MOVEMENT_LABELS: Record<MovementType, string> = {
  VENTA: 'Venta',
  DEVOLUCION: 'Devolución',
  INGRESO_VARIO: 'Ingreso',
  EGRESO: 'Egreso',
  RETIRO_PARCIAL: 'Retiro parcial',
  AJUSTE_SOBRANTE: 'Ajuste sobrante',
  AJUSTE_FALTANTE: 'Ajuste faltante',
  REVERSO: 'Reverso',
  BASE_APERTURA: 'Base de apertura',
  TRASLADO_CIERRE: 'Traslado de cierre',
  CONSIGNACION: 'Consignación',
};

const STATUS_LABELS: Record<MovementStatus, string> = {
  APLICADO: 'Aplicado',
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  RECHAZADO: 'Rechazado',
};

const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  ABIERTO: 'Abierto',
  EN_CIERRE: 'En cierre',
  CERRADO_PENDIENTE_APROBACION: 'Pendiente de aprobación',
  CERRADO: 'Cerrado',
};

export const METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  efectivo: 'Efectivo',
  datafono: 'Datáfono',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  breb: 'Bre-B',
  bancolombia: 'Bancolombia',
  otro_banco: 'Otro banco',
};

export const movementTypeLabel = (type: MovementType): string => MOVEMENT_LABELS[type] ?? type;
export const movementStatusLabel = (status: MovementStatus): string =>
  STATUS_LABELS[status] ?? status;
export const shiftStatusLabel = (status: ShiftStatus): string =>
  SHIFT_STATUS_LABELS[status] ?? status;
export const methodTypeLabel = (type: PaymentMethodType): string =>
  METHOD_TYPE_LABELS[type] ?? type;

/** Mismas reglas que el servidor (el servidor igual valida): aplicado, de un tipo reversable y sin reverso. */
export function canReverseMovement(movement: MovementRow): boolean {
  return (
    movement.status === 'APLICADO' &&
    REVERSIBLE_TYPES.includes(movement.type) &&
    !movement.reversedByMovementId &&
    !movement.mirrorOfMovementId
  );
}

/** El cierre exigió justificación (diferencia fuera del umbral). No trae cifras. */
export function isJustificationRequired(error: unknown): boolean {
  return error instanceof CashApiError && error.code === 'JUSTIFICATION_REQUIRED';
}

export const JUSTIFICATION_REQUIRED_MESSAGE =
  'Se requiere una justificación para enviar este cierre';

export type ClosingOutcome = 'CERRADO' | 'PENDIENTE';

/** Texto que ve el cajero tras enviar el conteo: solo el estado, nunca cifras. */
export function closingOutcomeLabel(status: ShiftStatus): string {
  return status === 'CERRADO' ? 'Turno cerrado' : 'Enviado a aprobación';
}
