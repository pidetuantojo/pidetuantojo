// SOLO servidor: bitácora de auditoría de operaciones de caja/contabilidad.
// Guarda quién, cuándo, desde dónde y qué entidad; nunca cuerpos de petición ni datos personales.
import type { Transaction } from 'firebase-admin/firestore';

import type { Caller } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';

import { toAccountingDate } from './bogotaDate';

const USER_AGENT_MAX = 200;

export interface AuditExtra {
  registerId?: string;
  shiftId?: string;
  orderId?: string;
  reason?: string;
}

export interface AuditContext extends AuditExtra {
  uid: string;
  /** Instante UTC (ISO). */
  at: string;
  /** Día contable en Bogotá (YYYY-MM-DD). */
  accountingDate: string;
  ip: string | null;
  userAgent: string | null;
}

export function buildAuditContext(
  request: Request,
  caller: Pick<Caller, 'uid'>,
  extra: AuditExtra = {}
): AuditContext {
  const now = new Date();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip')?.trim() || null;
  const userAgent = request.headers.get('user-agent')?.slice(0, USER_AGENT_MAX) || null;
  return {
    uid: caller.uid,
    at: now.toISOString(),
    accountingDate: toAccountingDate(now),
    ip,
    userAgent,
    ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)),
  };
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  context: AuditContext;
  /** Datos mínimos del cambio (ids, montos). Sin cuerpos completos ni PII. */
  data?: Record<string, unknown>;
}

/** Escritura dentro de la transacción (después de todas las lecturas). */
export function writeAuditLog(tx: Transaction, restaurantId: string, entry: AuditEntry): string {
  const ref = adminDb.collection(`restaurants/${restaurantId}/auditLog`).doc();
  tx.create(ref, {
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    context: entry.context,
    ...(entry.data ? { data: entry.data } : {}),
  });
  return ref.id;
}
