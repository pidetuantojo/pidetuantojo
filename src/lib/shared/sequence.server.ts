// SOLO servidor: consecutivos sin huecos (recibos, comprobantes, asientos).
// El incremento y el documento que usa el número comparten transacción: el número solo se
// consume si la transacción confirma.
import type { Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

export interface SequenceReservation {
  /** Número reservado (empieza en 1). */
  value: number;
  /** Escribe el nuevo contador. Llamar después de TODAS las lecturas de la transacción. */
  commit: (tx: Transaction) => void;
}

export function sequencePath(restaurantId: string, name: string): string {
  return `restaurants/${restaurantId}/sequences/${name}`;
}

/** Lectura dentro de la transacción: devuelve el siguiente número y cómo confirmarlo. */
export async function reserveSequence(
  tx: Transaction,
  restaurantId: string,
  name: string
): Promise<SequenceReservation> {
  const ref = adminDb.doc(sequencePath(restaurantId, name));
  const snap = await tx.get(ref);
  const current = snap.exists ? Number((snap.data() as { current?: number }).current ?? 0) : 0;
  const value = current + 1;
  return {
    value,
    commit: (writeTx) => {
      writeTx.set(ref, { current: value, updatedAt: new Date().toISOString() });
    },
  };
}

/** `formatSequence('RC', 1)` → `RC-000001`. */
export function formatSequence(prefix: string, n: number, pad = 6): string {
  return `${prefix}-${String(n).padStart(pad, '0')}`;
}
