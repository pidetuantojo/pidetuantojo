// Tipos de los reportes de caja (cierre por turno, resumen diario y estado de caja menor).
import type { Money } from '@/lib/shared/money';
import type { PaymentMethodType } from '@/types';

import type {
  CashClosing,
  CashMovement,
  CashRegister,
  CashShift,
  RegisterType,
} from './cash.types';
import type { PettyExpenseStatus, PettyReimbursement, PettyStatus } from './petty/petty.types';

export interface ShiftReport {
  shift: Omit<CashShift, 'audit'>;
  register: Pick<CashRegister, 'id' | 'name' | 'type'> | null;
  cashierUid: string;
  openingCount: CashShift['openingCount'];
  openingTotal: Money;
  movements: Omit<CashMovement, 'audit'>[];
  closing: Omit<CashClosing, 'approval'> | null;
  approval: CashClosing['approval'] | null;
  /** Números de los asientos contables ligados a los movimientos del turno. */
  journalEntryNumbers: string[];
}

export interface MethodTotals {
  methodType: PaymentMethodType;
  in: Money;
  out: Money;
  net: Money;
  count: number;
  /** De lo anterior, lo que corresponde a espejos de traslados (solo informativo). */
  mirrorIn: Money;
  mirrorOut: Money;
}

export interface RegisterDailySummary {
  registerId: string;
  name: string;
  type: RegisterType | null;
  methods: MethodTotals[];
  totals: { in: Money; out: Money; net: Money; count: number };
}

export interface RestaurantMethodTotals {
  methodType: PaymentMethodType;
  in: Money;
  out: Money;
  net: Money;
  count: number;
}

export interface DailySummary {
  date: string;
  /** Regla de totales, para mostrarla junto al reporte. */
  rule: string;
  registers: RegisterDailySummary[];
  /** Totales del restaurante: EXCLUYEN los espejos para no contar dos veces un traslado. */
  restaurantTotals: {
    methods: RestaurantMethodTotals[];
    in: Money;
    out: Money;
    net: Money;
    count: number;
  };
}

export interface PettyCategoryGroup {
  categoryId: string;
  categoryName: string;
  status: PettyExpenseStatus;
  count: number;
  total: Money;
}

export interface PettyReport {
  registerId: string;
  registerName: string;
  from: string;
  to: string;
  status: PettyStatus;
  expensesByCategory: PettyCategoryGroup[];
  expensesTotal: Money;
  expenseCount: number;
  reimbursements: Omit<PettyReimbursement, 'audit'>[];
  reimbursedTotal: Money;
}
