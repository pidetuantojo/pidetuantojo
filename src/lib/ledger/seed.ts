// UNICO lugar con códigos de cuenta (PUC). El resto del código trabaja con ids y reglas configurables.
import type { PaymentMethodType } from '@/types';

import type { AccountClass, AccountingEvent, AccountNature } from './ledger.types';

export interface SeedAccount {
  code: string;
  name: string;
  class: AccountClass;
  nature: AccountNature;
  parentCode?: string;
  allowsMovements: boolean;
}

export const SEED_ACCOUNTS: readonly SeedAccount[] = [
  { code: '1105', name: 'Caja', class: 'ACTIVO', nature: 'DEBITO', allowsMovements: false },
  {
    code: '110505',
    name: 'Caja general',
    class: 'ACTIVO',
    nature: 'DEBITO',
    parentCode: '1105',
    allowsMovements: true,
  },
  {
    code: '110510',
    name: 'Cajas menores',
    class: 'ACTIVO',
    nature: 'DEBITO',
    parentCode: '1105',
    allowsMovements: true,
  },
  { code: '1110', name: 'Bancos', class: 'ACTIVO', nature: 'DEBITO', allowsMovements: true },
  {
    code: '1365',
    name: 'Cuentas por cobrar a trabajadores',
    class: 'ACTIVO',
    nature: 'DEBITO',
    allowsMovements: true,
  },
  {
    code: '1380',
    name: 'Deudores varios - pasarelas de pago',
    class: 'ACTIVO',
    nature: 'DEBITO',
    allowsMovements: true,
  },
  {
    code: '2408',
    name: 'IVA por pagar',
    class: 'PASIVO',
    nature: 'CREDITO',
    allowsMovements: true,
  },
  {
    code: '4140',
    name: 'Hoteles y restaurantes',
    class: 'INGRESO',
    nature: 'CREDITO',
    allowsMovements: true,
  },
  {
    code: '4175',
    name: 'Devoluciones en ventas',
    class: 'INGRESO',
    nature: 'DEBITO',
    allowsMovements: true,
  },
  {
    code: '4295',
    name: 'Ingresos diversos - sobrantes',
    class: 'INGRESO',
    nature: 'CREDITO',
    allowsMovements: true,
  },
  {
    code: '5195',
    name: 'Gastos diversos',
    class: 'GASTO',
    nature: 'DEBITO',
    allowsMovements: true,
  },
];

/** Igual que `AccountRef` pero apuntando por código de cuenta. */
export type SeedRef =
  | { kind: 'fixed'; code: string }
  | { kind: 'sourceCashBox' }
  | { kind: 'targetCashBox' }
  | { kind: 'paymentMethod' }
  | { kind: 'expenseCategory' };

export interface SeedRule {
  event: AccountingEvent;
  methodType: PaymentMethodType | null;
  debit: SeedRef;
  credit: SeedRef;
}

const fixed = (code: string): SeedRef => ({ kind: 'fixed', code });
const SRC: SeedRef = { kind: 'sourceCashBox' };
const TGT: SeedRef = { kind: 'targetCashBox' };
const PAY: SeedRef = { kind: 'paymentMethod' };
const CAT: SeedRef = { kind: 'expenseCategory' };

const BANK_METHODS: readonly PaymentMethodType[] = [
  'nequi',
  'daviplata',
  'breb',
  'bancolombia',
  'otro_banco',
];

export const SEED_RULES: readonly SeedRule[] = [
  { event: 'SALE', methodType: 'efectivo', debit: SRC, credit: fixed('4140') },
  { event: 'SALE', methodType: 'datafono', debit: fixed('1380'), credit: fixed('4140') },
  ...BANK_METHODS.map((m): SeedRule => ({
    event: 'SALE',
    methodType: m,
    debit: PAY,
    credit: fixed('4140'),
  })),
  { event: 'SALE', methodType: null, debit: PAY, credit: fixed('4140') },
  { event: 'REFUND', methodType: 'efectivo', debit: fixed('4175'), credit: SRC },
  { event: 'REFUND', methodType: 'datafono', debit: fixed('4175'), credit: fixed('1380') },
  ...BANK_METHODS.map((m): SeedRule => ({
    event: 'REFUND',
    methodType: m,
    debit: fixed('4175'),
    credit: PAY,
  })),
  { event: 'REFUND', methodType: null, debit: fixed('4175'), credit: PAY },
  { event: 'OTHER_INCOME', methodType: null, debit: SRC, credit: fixed('4295') },
  { event: 'EXPENSE', methodType: null, debit: fixed('5195'), credit: SRC },
  { event: 'CASH_TRANSFER', methodType: null, debit: TGT, credit: SRC },
  { event: 'BANK_DEPOSIT', methodType: null, debit: fixed('1110'), credit: SRC },
  { event: 'CASH_SURPLUS', methodType: null, debit: SRC, credit: fixed('4295') },
  { event: 'CASH_SHORTAGE', methodType: null, debit: fixed('1365'), credit: SRC },
  { event: 'PETTY_CASH_EXPENSE', methodType: null, debit: CAT, credit: fixed('110510') },
  { event: 'PETTY_CASH_REPLENISH', methodType: null, debit: fixed('110510'), credit: SRC },
  { event: 'GATEWAY_SETTLEMENT', methodType: null, debit: fixed('1110'), credit: fixed('1380') },
];
