import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase/config';

import { parseTemplateStore, type WaEventCode, type WaTemplateStore } from './templates.core';

export * from './templates.core';

// ─── Firestore (panel) ────────────────────────────────────────────────────────
// settings/waTemplates solo lo leen miembros del restaurante: la carta pública recibe
// el mensaje de pedido nuevo ya armado desde /api/orders.

function templatesRef(restaurantId: string) {
  return doc(db, 'restaurants', restaurantId, 'settings', 'waTemplates');
}

export async function getWaTemplateStore(restaurantId: string): Promise<WaTemplateStore> {
  const snap = await getDoc(templatesRef(restaurantId));
  return parseTemplateStore(snap.exists() ? snap.data() : undefined);
}

export async function saveSystemTemplate(restaurantId: string, code: WaEventCode, body: string): Promise<void> {
  await setDoc(templatesRef(restaurantId), { [code]: body }, { merge: true });
}

/** Crea o actualiza una plantilla propia. */
export async function saveCustomTemplate(
  restaurantId: string,
  template: { id?: string; name: string; body: string; createdAt?: string },
): Promise<string> {
  const id = template.id ?? `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await setDoc(templatesRef(restaurantId), {
    custom: { [id]: { name: template.name, body: template.body, createdAt: template.createdAt ?? new Date().toISOString() } },
  }, { merge: true });
  return id;
}

export async function deleteCustomTemplate(restaurantId: string, id: string): Promise<void> {
  await updateDoc(templatesRef(restaurantId), { [`custom.${id}`]: deleteField() });
}
