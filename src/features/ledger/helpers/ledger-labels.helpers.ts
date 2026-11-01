import type { PaymentMethodType } from '@/types';

import type {
  AccountClass,
  AccountingEvent,
  AccountNature,
  AccountRef,
  LedgerAccount,
} from '../types/ledger.types';

export const EVENT_LABELS: Record<AccountingEvent, string> = {
  SALE: 'Venta',
  REFUND: 'Devolución de venta',
  OTHER_INCOME: 'Ingreso vario',
  EXPENSE: 'Egreso de caja',
  CASH_TRANSFER: 'Traslado entre cajas',
  BANK_DEPOSIT: 'Consignación bancaria',
  CASH_SURPLUS: 'Sobrante de caja',
  CASH_SHORTAGE: 'Faltante de caja',
  PETTY_CASH_EXPENSE: 'Gasto de caja menor',
  PETTY_CASH_REPLENISH: 'Reposición de caja menor',
  GATEWAY_SETTLEMENT: 'Liquidación de pasarela',
};

export const METHOD_LABELS: Record<PaymentMethodType, string> = {
  efectivo: 'Efectivo',
  datafono: 'Datáfono',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  breb: 'Bre-B',
  bancolombia: 'Bancolombia',
  otro_banco: 'Otro banco',
};

export const CLASS_LABELS: Record<AccountClass, string> = {
  ACTIVO: 'Activo',
  PASIVO: 'Pasivo',
  PATRIMONIO: 'Patrimonio',
  INGRESO: 'Ingreso',
  GASTO: 'Gasto',
  COSTO: 'Costo',
};

export const NATURE_LABELS: Record<AccountNature, string> = {
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
};

export const ACCOUNT_CLASSES = Object.keys(CLASS_LABELS) as AccountClass[];

/** Naturaleza habitual de cada clase (el contador puede cambiarla). */
export const DEFAULT_NATURE: Record<AccountClass, AccountNature> = {
  ACTIVO: 'DEBITO',
  GASTO: 'DEBITO',
  COSTO: 'DEBITO',
  PASIVO: 'CREDITO',
  PATRIMONIO: 'CREDITO',
  INGRESO: 'CREDITO',
};

export const REF_KINDS: { kind: AccountRef['kind']; label: string }[] = [
  { kind: 'fixed', label: 'Cuenta fija' },
  { kind: 'sourceCashBox', label: 'Caja del movimiento' },
  { kind: 'targetCashBox', label: 'Caja destino' },
  { kind: 'paymentMethod', label: 'Cuenta del medio de pago' },
  { kind: 'expenseCategory', label: 'Categoría del gasto' },
];

export const accountText = (account: Pick<LedgerAccount, 'code' | 'name'>) =>
  `${account.code} · ${account.name}`;

/** Descripción legible de un lado de la regla (cuenta fija con nombre, o el origen dinámico). */
export function describeRef(
  ref: AccountRef,
  accountsById: ReadonlyMap<string, Pick<LedgerAccount, 'code' | 'name'>>
): string {
  if (ref.kind === 'fixed') {
    const account = accountsById.get(ref.accountId);
    return account ? accountText(account) : 'Cuenta eliminada';
  }
  return REF_KINDS.find((k) => k.kind === ref.kind)?.label ?? ref.kind;
}
