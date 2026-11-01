import { CashApiError } from '../services/cash.api';

const MESSAGES: Record<string, string> = {
  SHIFT_REQUIRED: 'Abrí un turno de caja para cobrar en efectivo',
  OVERPAYMENT: 'El pago supera el saldo del pedido',
  ORDER_NOT_PAYABLE: 'El pedido no admite pagos (está cancelado o eliminado)',
  ORDER_NOT_FOUND: 'El pedido ya no existe',
  METHOD_NOT_ALLOWED: 'Ese medio de pago no está disponible para este pedido',
  INVALID_RECEIVED: 'Lo recibido no cubre el valor del cobro',
  LEGACY_PAYMENT: 'Este pago es anterior al módulo de caja: usá "Devolución"',
  ALREADY_REVERSED: 'Ese pago ya fue reversado',
  SHIFT_CLOSED: 'El turno de ese pago ya cerró: usá "Devolución"',
  REFUND_LIMIT: 'La devolución supera lo cobrado menos lo ya devuelto',
  PAYMENT_NOT_FOUND: 'El pago ya no existe en el pedido',
  INSUFFICIENT_CASH: 'La caja no tiene efectivo suficiente',
  ACTIVATION_PREREQUISITES: 'Faltan requisitos para activar la caja',
  EXPENSE_LIMIT_EXCEEDED: 'El gasto supera el máximo permitido por la caja menor',
  FUND_NOT_CONSTITUTED: 'Primero constituí el fondo de la caja menor',
  ATTACHMENT_REQUIRED: 'Adjuntá el soporte antes de legalizar el gasto',
  INVALID_EXPENSE_STATE: 'El gasto cambió de estado: actualizá la lista',
  INVALID_REIMBURSEMENT_STATE: 'El reembolso ya fue resuelto',
  TOO_MANY_EXPENSES: 'Demasiados gastos en un solo reembolso',
  PETTY_CATEGORY_NOT_FOUND: 'La categoría no existe o está inactiva',
};

const FORBIDDEN = 'No tenés permiso para realizar esta acción';
const FALLBACK = 'No se pudo completar la operación. Intentá de nuevo.';

/** Mensaje en español para mostrar al usuario ante cualquier error de la API de caja. */
export function cashErrorMessage(error: unknown): string {
  if (error instanceof CashApiError) {
    const known = MESSAGES[error.code];
    if (known) return known;
    if (error.status === 403) return FORBIDDEN;
    if (error.status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.';
    return error.message || FALLBACK;
  }
  return error instanceof Error && error.message ? error.message : FALLBACK;
}
