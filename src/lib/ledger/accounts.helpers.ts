// Reglas puras del plan de cuentas.
import { LedgerError } from './ledger.errors';
import type { AccountClass, AccountNature, LedgerAccount } from './ledger.types';

const CODE_PATTERN = /^\d{1,10}$/;

export function isValidAccountCode(code: unknown): code is string {
  return typeof code === 'string' && CODE_PATTERN.test(code);
}

export function assertAccountCode(code: unknown): asserts code is string {
  if (!isValidAccountCode(code)) {
    throw new LedgerError('INVALID_ACCOUNT_CODE', 'El código debe tener entre 1 y 10 dígitos');
  }
}

/** Naturaleza habitual de cada clase (4175 devoluciones es la excepción: se fija a mano). */
export function defaultNature(accountClass: AccountClass): AccountNature {
  return accountClass === 'ACTIVO' || accountClass === 'GASTO' || accountClass === 'COSTO'
    ? 'DEBITO'
    : 'CREDITO';
}

/** El padre debe existir y su código debe ser prefijo propio del código del hijo. */
export function assertParentConsistent(
  code: string,
  parentCode: string | undefined,
  existingCodes: ReadonlySet<string>
): void {
  if (parentCode === undefined) return;
  assertAccountCode(parentCode);
  if (parentCode.length >= code.length || !code.startsWith(parentCode)) {
    throw new LedgerError('PARENT_MISMATCH', 'El código padre debe ser un prefijo del código');
  }
  if (!existingCodes.has(parentCode)) {
    throw new LedgerError('PARENT_NOT_FOUND', `No existe la cuenta padre ${parentCode}`);
  }
}

export function isPostable(account: Pick<LedgerAccount, 'isActive' | 'allowsMovements'>): boolean {
  return account.isActive && account.allowsMovements;
}
