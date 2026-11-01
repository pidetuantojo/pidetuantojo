// Errores de dominio del libro contable. Puros: sin Firebase ni Next.
export type LedgerErrorCode =
  | 'UNBALANCED'
  | 'EMPTY'
  | 'ZERO_LINE'
  | 'NEGATIVE_AMOUNT'
  | 'INVALID_AMOUNT'
  | 'BOTH_SIDES'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_NOT_POSTABLE'
  | 'INVALID_DATE'
  | 'RULE_NOT_FOUND'
  | 'MISSING_CONTEXT'
  | 'ALREADY_REVERSED'
  | 'CANNOT_REVERSE_REVERSAL'
  | 'ENTRY_NOT_FOUND'
  | 'INVALID_ACCOUNT_CODE'
  | 'PARENT_NOT_FOUND'
  | 'PARENT_MISMATCH'
  | 'DUPLICATE_CODE'
  | 'ACCOUNT_IMMUTABLE'
  | 'ACCOUNT_USED_BY_RULE'
  | 'DUPLICATE_RULE'
  | 'RULE_INACTIVE'
  | 'INVALID_CURSOR';

const NOT_FOUND: readonly LedgerErrorCode[] = ['ENTRY_NOT_FOUND', 'RULE_NOT_FOUND'];
const CONFLICT: readonly LedgerErrorCode[] = [
  'ALREADY_REVERSED',
  'CANNOT_REVERSE_REVERSAL',
  'DUPLICATE_CODE',
  'DUPLICATE_RULE',
  'ACCOUNT_IMMUTABLE',
  'ACCOUNT_USED_BY_RULE',
  'RULE_INACTIVE',
];

export class LedgerError extends Error {
  constructor(
    readonly code: LedgerErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'LedgerError';
  }

  /** Código HTTP sugerido para responder desde una ruta. */
  get status(): 400 | 404 | 409 {
    if (NOT_FOUND.includes(this.code)) return 404;
    if (CONFLICT.includes(this.code)) return 409;
    return 400;
  }
}
