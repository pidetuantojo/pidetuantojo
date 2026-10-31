// SOLO servidor: contexto de lectura compartido por todos los movimientos de UNA transacción.
// Carga una sola vez reglas contables y configuración; cajas y turnos se leen bajo demanda y se
// cachean. Crear un contexto por intento de transacción (nunca reutilizarlo entre reintentos).
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { ledgerCollectionPath } from '@/lib/ledger/ledger.paths';
import type { AccountingRule } from '@/lib/ledger/ledger.types';
import type { AuditContext } from '@/lib/shared/audit.server';
import { createSequenceAllocator, type SequenceAllocator } from '@/lib/shared/sequence.server';
import type { PaymentMethodConfig } from '@/types';

import { CashError } from './cash.errors';
import { cashDocPath, SETTINGS_DOC_ID } from './cash.paths';
import type { CashRegister, CashSettings, CashShift } from './cash.types';
import { DEFAULT_DENOMINATIONS } from './denominations.helpers';

export interface MovementContext {
  tx: Transaction;
  restaurantId: string;
  audit: AuditContext;
  sequences: SequenceAllocator;
  rules: AccountingRule[];
  settings: CashSettings;
  registerOf: (id: string) => Promise<CashRegister>;
  shiftOf: (id: string) => Promise<CashShift>;
  /** Turno recién armado en esta misma transacción (aún no existe en Firestore). */
  seedShift: (shift: CashShift) => void;
  paymentMethods: () => Promise<PaymentMethodConfig[]>;
}

export function defaultSettings(): CashSettings {
  return {
    denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })),
    paymentMethodAccounts: {},
  };
}

/** Lee la configuración dentro de la transacción; sin documento devuelve los valores por defecto. */
export async function readSettings(tx: Transaction, restaurantId: string): Promise<CashSettings> {
  const snap = await tx.get(
    adminDb.doc(cashDocPath(restaurantId, 'settings', SETTINGS_DOC_ID)) as DocumentReference
  );
  if (!snap.exists) return defaultSettings();
  const stored = snap.data() as Partial<CashSettings>;
  return {
    ...defaultSettings(),
    ...stored,
    denominations: stored.denominations?.length
      ? stored.denominations
      : defaultSettings().denominations,
    paymentMethodAccounts: stored.paymentMethodAccounts ?? {},
  };
}

export async function createMovementContext(
  tx: Transaction,
  restaurantId: string,
  audit: AuditContext
): Promise<MovementContext> {
  const rulesSnap = await tx.get(adminDb.collection(ledgerCollectionPath(restaurantId, 'rules')));
  const rules = rulesSnap.docs.map((d) => ({ ...(d.data() as AccountingRule), id: d.id }));
  const settings = await readSettings(tx, restaurantId);

  const registers = new Map<string, Promise<CashRegister>>();
  const shifts = new Map<string, Promise<CashShift>>();
  let methods: Promise<PaymentMethodConfig[]> | undefined;

  return {
    tx,
    restaurantId,
    audit,
    sequences: createSequenceAllocator(tx, restaurantId),
    rules,
    settings,
    registerOf: (id) => {
      let cached = registers.get(id);
      if (!cached) {
        cached = tx
          .get(adminDb.doc(cashDocPath(restaurantId, 'registers', id)) as DocumentReference)
          .then((snap) => {
            if (!snap.exists) throw new CashError('REGISTER_NOT_FOUND', 'La caja no existe');
            return { ...(snap.data() as CashRegister), id: snap.id };
          });
        registers.set(id, cached);
      }
      return cached;
    },
    shiftOf: (id) => {
      let cached = shifts.get(id);
      if (!cached) {
        cached = tx
          .get(adminDb.doc(cashDocPath(restaurantId, 'shifts', id)) as DocumentReference)
          .then((snap) => {
            if (!snap.exists) throw new CashError('SHIFT_NOT_FOUND', 'El turno no existe');
            return { ...(snap.data() as CashShift), id: snap.id };
          });
        shifts.set(id, cached);
      }
      return cached;
    },
    seedShift: (shift) => {
      shifts.set(shift.id, Promise.resolve(shift));
    },
    paymentMethods: () => {
      methods ??= tx
        .get(adminDb.doc(`restaurants/${restaurantId}`) as DocumentReference)
        .then(
          (snap) =>
            (snap.data() as { paymentMethods?: PaymentMethodConfig[] } | undefined)
              ?.paymentMethods ?? []
        );
      return methods;
    },
  };
}
