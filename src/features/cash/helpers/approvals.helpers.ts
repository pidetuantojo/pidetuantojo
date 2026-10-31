import type { Money } from '@/lib/shared/money';
import type { PaymentMethodConfig } from '@/types';
import { getActivePaymentMethods } from '@/features/payment-methods/helpers/payment-methods.helpers';

import type {
  CashRegister,
  LedgerAccount,
  MovementRow,
  PendingWithdrawal,
  ShiftRow,
} from '../types/cash.types';

/** Retiros parciales pendientes de los turnos dados (los movimientos vienen por turno). */
export function collectPendingWithdrawals(
  entries: readonly { shift: ShiftRow; movements: readonly MovementRow[] }[]
): PendingWithdrawal[] {
  return entries.flatMap(({ shift, movements }) =>
    movements
      .filter((m) => m.type === 'RETIRO_PARCIAL' && m.status === 'PENDIENTE_APROBACION')
      .map((movement) => ({ shift, movement }))
  );
}

/** Quien registró el movimiento o cerró el turno no puede aprobarlo (el servidor lo exige igual). */
export const isOwnShift = (uid: string | undefined, shift: Pick<ShiftRow, 'cashierUid'>): boolean =>
  !!uid && uid === shift.cashierUid;

/** Cuentas que reciben asientos: activas y no de agrupación. */
export function postableAccounts(accounts: readonly LedgerAccount[]): LedgerAccount[] {
  return accounts.filter((a) => a.isActive && a.allowsMovements);
}

/** Cuentas de banco/caja (clase ACTIVO) donde se puede consignar o liquidar. */
export function bankAccounts(accounts: readonly LedgerAccount[]): LedgerAccount[] {
  return postableAccounts(accounts).filter((a) => a.class === 'ACTIVO');
}

export const accountLabel = (account: Pick<LedgerAccount, 'code' | 'name'>): string =>
  `${account.code} · ${account.name}`;

/** Medios activos de tipo datáfono (los que se liquidan en lote al banco). */
export function datafonoMethods(methods: PaymentMethodConfig[] | undefined): PaymentMethodConfig[] {
  return getActivePaymentMethods(methods).filter((m) => m.type === 'datafono');
}

/** Medios activos que no son efectivo: cada uno necesita su cuenta contable. */
export function nonCashMethods(methods: PaymentMethodConfig[] | undefined): PaymentMethodConfig[] {
  return getActivePaymentMethods(methods).filter((m) => m.type !== 'efectivo');
}

export function generalRegisters(registers: readonly CashRegister[]): CashRegister[] {
  return registers.filter((r) => r.type === 'GENERAL' && r.isActive);
}

export function openableRegisters(registers: readonly CashRegister[]): CashRegister[] {
  return registers.filter((r) => r.type === 'REGISTRADORA' && r.isActive);
}

export type DifferenceTone = 'ok' | 'surplus' | 'shortage';

/** Positivo = sobrante (contó de más); negativo = faltante. */
export function differenceTone(difference: Money): DifferenceTone {
  if (difference === 0) return 'ok';
  return difference > 0 ? 'surplus' : 'shortage';
}

export const DIFFERENCE_LABELS: Record<DifferenceTone, string> = {
  ok: 'Sin diferencia',
  surplus: 'Sobrante',
  shortage: 'Faltante',
};

/** Los nombres de cajeros no están disponibles sin `team.view`: se muestra el final del uid. */
export function cashierLabel(uid: string, currentUid: string | undefined): string {
  return uid === currentUid ? 'Vos' : `Cajero …${uid.slice(-4)}`;
}
