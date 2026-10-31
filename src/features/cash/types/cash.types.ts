import type {
  CashMovement,
  CashShift,
  CountMap,
  Denomination,
  MoneyByMethod,
  RegisterType,
  ShiftStatus,
} from '@/lib/cash/cash.types';
import type { PaymentMethodType } from '@/types';
import type { ActivationStatus } from '@/lib/cash/activation.server';
import type { CashSettings } from '@/lib/cash/cash.types';
import type { RefundResult } from '@/lib/cash/refunds.server';
import type { OrderPaymentResult } from '@/lib/cash/order-payments.server';
import type { Money } from '@/lib/shared/money';

// Solo tipos del servidor (se borran al compilar): el cliente nunca importa código de Admin SDK.
export type { ActivationStatus, CashSettings, OrderPaymentResult, RefundResult };

export interface PayOrderItemInput {
  paymentMethodId: string;
  amount: Money;
  /** Solo efectivo: lo que entregó el cliente. */
  received?: Money;
  label?: string;
  externalRef?: string;
}

export interface PayOrderInput {
  orderId: string;
  payments: PayOrderItemInput[];
}

export interface ReversePaymentInput {
  orderId: string;
  paymentId: string;
  reason: string;
}

export interface RefundInput {
  orderId: string;
  paymentMethodId: string;
  amount: Money;
  reason: string;
}

/** Cuerpo de error de /api/cash/*: `{ error, code, ...extra }`. */
export interface CashApiErrorBody {
  error?: string;
  code?: string;
  missing?: string[];
}

// ── Turnos, movimientos, cajas y cierre (lo que devuelve la API, ya sin `audit`) ──────────────

export type {
  CashClosing,
  CashMovement,
  CashRegister,
  CashShift,
  CountMap,
  Denomination,
  MoneyByMethod,
  MovementStatus,
  MovementType,
  RegisterType,
  ShiftStatus,
} from '@/lib/cash/cash.types';
export type { LedgerAccount } from '@/lib/ledger/ledger.types';
export type { RegisterBalance } from '@/lib/cash/balance.server';

/** Turno propio del cajero: el servidor solo manda esto (sin totales ni conteos). */
export interface CurrentShift {
  id: string;
  registerId: string;
  status: ShiftStatus;
  openedAt: string;
  openingAccountingDate: string;
}

export type ShiftRow = Omit<CashShift, 'audit'>;
export type MovementRow = Omit<CashMovement, 'audit'>;

export interface ShiftMovementsView {
  movements: MovementRow[];
  /** Solo si quien consulta tiene `cash.approve`. El cajero nunca lo recibe. */
  totalsByMethod?: MoneyByMethod;
}

export interface OpenShiftInput {
  registerId: string;
  openingCount: CountMap;
}

export type ManualMovementType = 'INGRESO_VARIO' | 'EGRESO' | 'RETIRO_PARCIAL';

export interface ManualMovementInput {
  type: ManualMovementType;
  amount: Money;
  methodType: PaymentMethodType;
  paymentMethodId?: string;
  reason: string;
}

export interface WithdrawalDecisionInput {
  decision: 'APROBAR' | 'RECHAZAR';
  note?: string;
}

export interface SubmitCountInput {
  cashCount: CountMap;
  declaredByMethod?: MoneyByMethod;
  justification?: string;
}

/** Respuesta del conteo y del inicio de cierre: solo el estado, jamás cifras. */
export interface ShiftAck {
  shiftId: string;
  status: ShiftStatus;
}

export interface ApproveCloseInput {
  note: string;
  shortageAccountId?: string;
}

export interface CreateRegisterInput {
  type: RegisterType;
  name: string;
  ledgerAccountId: string;
  diffThreshold: Money;
}

export interface UpdateRegisterInput {
  name?: string;
  isActive?: boolean;
  diffThreshold?: Money;
  ledgerAccountId?: string;
}

export interface GeneralMovementInput {
  type: 'INGRESO_VARIO' | 'EGRESO';
  amount: Money;
  reason: string;
  externalRef?: string;
  accountOverrideId?: string;
}

export interface DepositInput {
  registerId: string;
  bankAccountId: string;
  amount: Money;
  externalRef: string;
}

export interface SettlementInput {
  paymentMethodId: string;
  bankAccountId: string;
  amount: Money;
  externalRef: string;
  accountingDate?: string;
}

export interface UpdateSettingsInput {
  denominations: Denomination[];
  paymentMethodAccounts: Record<string, string>;
  defaultGeneralRegisterId?: string;
}

export interface LedgerSetupResult {
  created: boolean;
  accounts: number;
  rules: number;
}

/** Retiro parcial esperando decisión, con el turno al que pertenece. */
export interface PendingWithdrawal {
  shift: ShiftRow;
  movement: MovementRow;
}

export interface PendingApprovals {
  withdrawals: PendingWithdrawal[];
  closes: ShiftRow[];
}
