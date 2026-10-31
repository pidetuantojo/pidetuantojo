// SOLO servidor: saldo materializado por caja (`cashRegisterBalances/{registerId}`).
// Se lee en la fase de lectura (cacheado por caja y por transacción) y se escribe en la fase de
// confirmación con `tx.set`: Firestore detecta el conflicto si otra transacción lo cambió, así dos
// egresos/consignaciones simultáneos no pueden gastar el mismo efectivo (una consulta por rango no
// protege contra inserciones fantasma).
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { sumMoney } from '@/lib/shared/money';
import type { PaymentMethodType } from '@/types';

import { cashDocPath } from './cash.paths';
import type { MoneyByMethod, MovementDirection } from './cash.types';

export interface RegisterBalanceDoc {
  byMethod: MoneyByMethod;
  movementsCount: number;
  lastMovementId: string | null;
  updatedAt: string | null;
}

export const emptyBalanceDoc = (): RegisterBalanceDoc => ({
  byMethod: {},
  movementsCount: 0,
  lastMovementId: null,
  updatedAt: null,
});

export interface BalanceDelta {
  movementId: string;
  methodType: PaymentMethodType;
  direction: MovementDirection;
  amount: number;
}

/** Aplica un movimiento a un saldo. Puro (sin Firestore). */
export function applyDelta(
  doc: RegisterBalanceDoc,
  delta: BalanceDelta,
  at: string
): RegisterBalanceDoc {
  const signed = delta.direction === 'IN' ? delta.amount : -delta.amount;
  return {
    byMethod: {
      ...doc.byMethod,
      [delta.methodType]: sumMoney([doc.byMethod[delta.methodType] ?? 0, signed]),
    },
    movementsCount: doc.movementsCount + 1,
    lastMovementId: delta.movementId,
    updatedAt: at,
  };
}

export interface BalanceStore {
  /** Lectura (antes de cualquier escritura). Idempotente y cacheada por caja. */
  load: (registerId: string) => Promise<RegisterBalanceDoc>;
  /** Efectivo actual de la caja (incluye lo aplicado antes en esta misma transacción). */
  cashOf: (registerId: string) => Promise<number>;
  /** Confirmación: exige `load` previo; acumula en memoria y escribe el documento completo. */
  apply: (registerId: string, delta: BalanceDelta, at: string) => void;
}

export function createBalanceStore(tx: Transaction, restaurantId: string): BalanceStore {
  const pending = new Map<string, Promise<RegisterBalanceDoc>>();
  const current = new Map<string, RegisterBalanceDoc>();
  const refOf = (registerId: string) =>
    adminDb.doc(cashDocPath(restaurantId, 'balances', registerId)) as DocumentReference;

  const load = (registerId: string) => {
    let cached = pending.get(registerId);
    if (!cached) {
      cached = tx.get(refOf(registerId)).then((snap) => {
        const doc = snap.exists
          ? { ...emptyBalanceDoc(), ...(snap.data() as Partial<RegisterBalanceDoc>) }
          : emptyBalanceDoc();
        current.set(registerId, doc);
        return doc;
      });
      pending.set(registerId, cached);
    }
    return cached;
  };

  return {
    load,
    cashOf: async (registerId) => {
      await load(registerId);
      return current.get(registerId)?.byMethod.efectivo ?? 0;
    },
    apply: (registerId, delta, at) => {
      const doc = current.get(registerId);
      if (!doc) throw new Error(`Saldo de la caja ${registerId} no fue leído antes de escribir`);
      const next = applyDelta(doc, delta, at);
      current.set(registerId, next);
      tx.set(refOf(registerId), next);
    },
  };
}
