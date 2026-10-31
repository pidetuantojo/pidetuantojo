// SOLO servidor: idempotencia de operaciones que mueven dinero.
// Uso dentro de una transacción: primero `checkIdempotency` (lectura), al final `save` (escritura).
import { createHash } from 'node:crypto';

import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

import { AuthError } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === 'string' && KEY_PATTERN.test(key);
}

/** Lee y valida el header `Idempotency-Key`. */
export function readIdempotencyKey(request: Request): string {
  const key = request.headers.get(IDEMPOTENCY_HEADER);
  if (!key) throw new AuthError('Falta el header Idempotency-Key', 400);
  if (!isValidIdempotencyKey(key)) throw new AuthError('Idempotency-Key inválido', 400);
  return key;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** JSON canónico: claves ordenadas, así el mismo payload siempre da el mismo hash. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function hashRequestPayload(payload: unknown): string {
  return sha256(canonicalJson(payload));
}

export function idempotencyDocPath(restaurantId: string, scope: string, key: string): string {
  return `restaurants/${restaurantId}/idempotencyKeys/${sha256(`${scope}:${key}`)}`;
}

export interface IdempotencyInput {
  restaurantId: string;
  scope: string;
  key: string;
  uid: string;
  payload: unknown;
}

interface StoredIdempotency<R> {
  scope: string;
  uid: string;
  requestHash: string;
  result: R;
  createdAt: string;
}

export type IdempotencyCheck<R> =
  | { status: 'replay'; result: R }
  | { status: 'new'; save: (tx: Transaction, result: R) => void };

/**
 * Lectura dentro de la transacción. `replay` → devolver el resultado guardado sin escribir nada.
 * Misma llave con otro payload u otro scope → 409. `new` → llamar `save` al final con el resultado.
 */
export async function checkIdempotency<R>(
  tx: Transaction,
  input: IdempotencyInput
): Promise<IdempotencyCheck<R>> {
  const { restaurantId, scope, key, uid, payload } = input;
  const ref = adminDb.doc(idempotencyDocPath(restaurantId, scope, key)) as DocumentReference;
  const requestHash = hashRequestPayload(payload);
  const snap = await tx.get(ref);

  if (snap.exists) {
    const stored = snap.data() as StoredIdempotency<R>;
    if (stored.scope !== scope || stored.requestHash !== requestHash) {
      throw new AuthError('Idempotency-Key ya fue usada con una solicitud distinta', 409);
    }
    return { status: 'replay', result: stored.result };
  }

  return {
    status: 'new',
    save: (writeTx, result) => {
      const doc: StoredIdempotency<R> = {
        scope,
        uid,
        requestHash,
        result,
        createdAt: new Date().toISOString(),
      };
      writeTx.create(ref, doc);
    },
  };
}
