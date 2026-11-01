import { LedgerApiError } from '../services/ledger.http';

const MESSAGES: Record<string, string> = {
  DUPLICATE_CODE: 'Ya existe una cuenta con ese código',
  ACCOUNT_IMMUTABLE:
    'Esa cuenta ya tiene movimientos: no se puede cambiar su código, clase ni naturaleza',
  ACCOUNT_USED_BY_RULE:
    'La cuenta está en uso por una regla contable activa: cambiá la regla primero',
  ACCOUNT_NOT_FOUND: 'La cuenta no existe',
  ACCOUNT_INACTIVE: 'La cuenta está inactiva',
  ACCOUNT_NOT_POSTABLE: 'La cuenta es de agrupación y no admite movimientos',
  INVALID_ACCOUNT_CODE: 'El código de la cuenta no es válido',
  PARENT_NOT_FOUND: 'La cuenta padre no existe',
  PARENT_MISMATCH: 'La cuenta padre no coincide con el código o la clase',
  ALREADY_REVERSED: 'Ese asiento ya fue reversado',
  CANNOT_REVERSE_REVERSAL: 'Una reversión no se puede reversar',
  ENTRY_NOT_FOUND: 'El asiento no existe',
  DUPLICATE_RULE: 'Ya existe una regla igual para ese evento y medio de pago',
  RULE_INACTIVE: 'La regla ya no está vigente',
  RULE_NOT_FOUND: 'La regla no existe',
};

const FALLBACK = 'No se pudo completar la operación. Intentá de nuevo.';

/** Mensaje en español para cualquier error de la API del libro contable. */
export function ledgerErrorMessage(error: unknown): string {
  if (error instanceof LedgerApiError) {
    const known = MESSAGES[error.code];
    if (known) return known;
    if (error.status === 403) return 'No tenés permiso para realizar esta acción';
    if (error.status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.';
    return error.message || FALLBACK;
  }
  return error instanceof Error && error.message ? error.message : FALLBACK;
}
