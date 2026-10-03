// SOLO servidor: tokens de avisos push y envío con Firebase Cloud Messaging.
// pushTokens/{sha256(token)} → { uid, restaurantId, token, platform, createdAt, updatedAt }
// Las reglas de Firestore no dejan leer ni escribir esta colección desde el cliente.
import { createHash } from 'node:crypto';

import { adminDb, adminMessaging } from '@/lib/firebase/admin';
import { can, legacyPermissions, normalizePermissions } from '@/lib/permissions/permissions';
import type { AppUser } from '@/types';

import { buildNewOrderPush, isInvalidTokenError, toFcmData, type NewOrderInfo, type PushData } from './payload';

export interface PushToken {
  uid: string;
  restaurantId: string;
  token: string;
  platform?: string;
  createdAt: string;
  updatedAt: string;
}

const tokensRef = () => adminDb.collection('pushTokens');

/** Id estable del documento (los tokens de FCM son largos y pueden tener caracteres raros). */
export function tokenDocId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function registerPushToken(input: { uid: string; restaurantId: string; token: string; platform?: string }): Promise<void> {
  const ref = tokensRef().doc(tokenDocId(input.token));
  const snap = await ref.get();
  const now = new Date().toISOString();
  // Si el dispositivo cambió de usuario, el token pasa al usuario actual
  await ref.set({
    uid: input.uid,
    restaurantId: input.restaurantId,
    token: input.token,
    ...(input.platform ? { platform: input.platform } : {}),
    createdAt: snap.exists ? (snap.data() as PushToken).createdAt : now,
    updatedAt: now,
  });
}

/** Borra el token solo si es del usuario que lo pide. */
export async function unregisterPushToken(uid: string, token: string): Promise<void> {
  const ref = tokensRef().doc(tokenDocId(token));
  const snap = await ref.get();
  if (snap.exists && (snap.data() as PushToken).uid === uid) await ref.delete();
}

function userCanSeeOrders(user: Partial<AppUser> | undefined, restaurantId: string): boolean {
  if (!user?.role || !user.isActive) return false;
  if (user.role === 'super_admin' || user.restaurantId !== restaurantId) return false;
  const permissions = user.effectivePermissions ? normalizePermissions(user.effectivePermissions) : legacyPermissions(user.role);
  return can(permissions, 'orders.view');
}

/**
 * Tokens que deben recibir el aviso: usuarios activos de ese restaurante con `orders.view`.
 * Los permisos se leen del usuario en el momento (si se lo quitaron, deja de recibir).
 */
export async function recipientTokens(restaurantId: string): Promise<{ docId: string; token: string }[]> {
  const snap = await tokensRef().where('restaurantId', '==', restaurantId).get();
  if (snap.empty) return [];
  const tokens = snap.docs.map((d) => ({ docId: d.id, ...(d.data() as PushToken) }));

  const uids = Array.from(new Set(tokens.map((t) => t.uid)));
  const userSnaps = await adminDb.getAll(...uids.map((uid) => adminDb.collection('users').doc(uid)));
  const allowed = new Set(
    userSnaps.filter((s) => userCanSeeOrders(s.data() as Partial<AppUser> | undefined, restaurantId)).map((s) => s.id)
  );
  return tokens.filter((t) => allowed.has(t.uid)).map((t) => ({ docId: t.docId, token: t.token }));
}

export interface SendResult {
  sent: number;
  failed: number;
  removed: number;
}

/** Envía y borra los tokens que FCM dice que ya no sirven. */
export async function sendPush(targets: { docId: string; token: string }[], data: PushData): Promise<SendResult> {
  if (targets.length === 0) return { sent: 0, failed: 0, removed: 0 };
  const fcmData = toFcmData(data);
  const response = await adminMessaging.sendEach(
    targets.map(({ token }) => ({
      token,
      data: fcmData,
      // Alta prioridad: que llegue aunque el celular esté en reposo
      android: { priority: 'high' as const },
      webpush: { headers: { Urgency: 'high', TTL: String(60 * 60) } },
      apns: { headers: { 'apns-priority': '10' } },
    }))
  );

  const invalid = response.responses
    .map((r, i) => (!r.success && isInvalidTokenError(r.error?.code) ? targets[i].docId : null))
    .filter((id): id is string => !!id);
  await Promise.all(invalid.map((id) => tokensRef().doc(id).delete()));

  return { sent: response.successCount, failed: response.failureCount, removed: invalid.length };
}

/** Aviso de pedido nuevo a todo el equipo del restaurante que ve pedidos. */
export async function notifyNewOrder(restaurantId: string, order: NewOrderInfo): Promise<SendResult> {
  return sendPush(await recipientTokens(restaurantId), buildNewOrderPush(order));
}

/** Tokens del usuario (para "Enviar prueba"). */
export async function userTokens(uid: string): Promise<{ docId: string; token: string }[]> {
  const snap = await tokensRef().where('uid', '==', uid).get();
  return snap.docs.map((d) => ({ docId: d.id, token: (d.data() as PushToken).token }));
}

/** Corre `task` con un tope de tiempo: el checkout nunca espera más que esto por el push. */
export async function withTimeout<T>(task: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), ms); });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
