import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface WaConfig {
  /** Si true, se envían mensajes automáticos al cliente cuando cambia el estado del pedido. */
  autoNotify: boolean;
}

function configRef(restaurantId: string) {
  return doc(db, 'restaurants', restaurantId, 'settings', 'waConfig');
}

export async function getWaConfig(restaurantId: string): Promise<WaConfig> {
  const snap = await getDoc(configRef(restaurantId));
  if (!snap.exists()) return { autoNotify: false };
  return { autoNotify: false, ...snap.data() } as WaConfig;
}

export async function saveWaConfig(restaurantId: string, config: Partial<WaConfig>): Promise<void> {
  await setDoc(configRef(restaurantId), config, { merge: true });
}
