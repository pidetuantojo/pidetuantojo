// Tipos de caja: cajas, turnos, movimientos y cierres. Dinero = pesos COP enteros.
import type { AuditContext } from '@/lib/shared/audit.server';
import type { Money } from '@/lib/shared/money';
import type { PaymentMethodType } from '@/types';

export type RegisterType = 'REGISTRADORA' | 'GENERAL' | 'MENOR';

export interface CashRegister {
  id: string;
  type: RegisterType;
  name: string;
  isActive: boolean;
  /** Cuenta contable (ACTIVO) donde se refleja el efectivo de la caja. */
  ledgerAccountId: string;
  /** Diferencia de cierre tolerada sin aprobación del supervisor. */
  diffThreshold: Money;
  /** Solo MENOR (fase 4). */
  fundAmount?: Money;
  maxExpense?: Money;
  /** Solo MENOR: instante en que se constituyó el fondo (sin esto el fondo aún no existe). */
  fundConstitutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ShiftStatus = 'ABIERTO' | 'EN_CIERRE' | 'CERRADO_PENDIENTE_APROBACION' | 'CERRADO';

export type CountMap = Record<string, number>;

export interface CashShift {
  id: string;
  registerId: string;
  cashierUid: string;
  status: ShiftStatus;
  openedAt: string;
  /** Día contable de Bogotá en que se abrió (un turno puede cerrar otro día). */
  openingAccountingDate: string;
  openingCount: CountMap;
  openingTotal: Money;
  openingMovementId?: string;
  closeStartedAt?: string;
  closeStartedBy?: string;
  closingId?: string;
  closedAt?: string;
  approvedBy?: string;
  audit: AuditContext;
}

export type MovementType =
  | 'VENTA'
  | 'DEVOLUCION'
  | 'INGRESO_VARIO'
  | 'EGRESO'
  | 'RETIRO_PARCIAL'
  | 'AJUSTE_SOBRANTE'
  | 'AJUSTE_FALTANTE'
  | 'REVERSO'
  | 'BASE_APERTURA'
  | 'TRASLADO_CIERRE'
  | 'CONSIGNACION'
  | 'GASTO_CAJA_MENOR'
  | 'REPOSICION_CAJA_MENOR'
  | 'DEVOLUCION_FONDO';

export type MovementDirection = 'IN' | 'OUT';
export type MovementStatus = 'APLICADO' | 'PENDIENTE_APROBACION' | 'RECHAZADO';

export interface CashMovement {
  id: string;
  type: MovementType;
  direction: MovementDirection;
  /** Entero positivo. */
  amount: Money;
  methodType: PaymentMethodType;
  paymentMethodId?: string;
  registerId: string;
  shiftId: string | null;
  /** Se guarda en el movimiento para que las reglas de Firestore lean por cajero. */
  cashierUid: string;
  counterpartRegisterId?: string;
  /** Id compartido por un traslado y su espejo en la caja contraparte. */
  transferId?: string;
  /** Solo en el espejo: el movimiento original en la otra caja (no cuenta en ningún turno). */
  mirrorOfMovementId?: string;
  /** Solo CONSIGNACION: cuenta bancaria destino. */
  bankAccountId?: string;
  orderId?: string;
  externalRef?: string;
  reason?: string;
  status: MovementStatus;
  receiptNumber: string;
  /** Día contable de Bogotá del hecho (no el de apertura del turno). */
  accountingDate: string;
  journalEntryId: string | null;
  journalSkippedReason?: 'SAME_ACCOUNT' | 'RECOGNIZED_ON_REIMBURSEMENT';
  reversesMovementId?: string;
  reversedByMovementId?: string;
  approvedBy?: string;
  decisionNote?: string;
  audit: AuditContext;
  createdAt: string;
}

export type DenominationKind = 'BILLETE' | 'MONEDA';

export interface Denomination {
  key: string;
  value: Money;
  kind: DenominationKind;
}

export interface CashSettings {
  denominations: Denomination[];
  /** id de PaymentMethodConfig → cuenta contable de ese medio (bancos, pasarelas). */
  paymentMethodAccounts: Record<string, string>;
  defaultGeneralRegisterId?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type MoneyByMethod = Partial<Record<PaymentMethodType, Money>>;

export type ClosingStatus = 'PENDIENTE_APROBACION' | 'CERRADO';

/** Foto inmutable del cierre. Solo el bloque `approval` y el estado se completan al aprobar. */
export interface CashClosing {
  id: string;
  shiftId: string;
  registerId: string;
  cashierUid: string;
  countSubmittedBy: string;
  countSubmittedAt: string;
  cashCount: CountMap;
  countedCash: Money;
  expectedByMethod: MoneyByMethod;
  declaredByMethod: MoneyByMethod;
  differenceByMethod: MoneyByMethod;
  cashDifference: Money;
  diffThreshold: Money;
  justification?: string;
  status: ClosingStatus;
  adjustmentMovementId?: string;
  transferMovementId?: string;
  approval?: {
    approvedBy: string;
    approvedAt: string;
    note: string;
    shortageAccountId?: string;
  };
  closedAt?: string;
}
