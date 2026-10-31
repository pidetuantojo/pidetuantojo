import type { AppUser, OrderStatusChange } from '@/types';

export interface StatusActor {
  uid: string;
  name?: string;
}

export function toStatusActor(user: AppUser | null | undefined): StatusActor | null {
  return user ? { uid: user.uid, name: user.displayName || user.email } : null;
}

/** Entrada del historial de estados. Firestore no acepta undefined: los campos opcionales solo si hay valor. */
export function statusChange(statusId: string, actor?: StatusActor | null, at = new Date().toISOString()): OrderStatusChange {
  return {
    statusId,
    at,
    ...(actor?.uid ? { by: actor.uid } : {}),
    ...(actor?.name ? { byName: actor.name } : {}),
  };
}
