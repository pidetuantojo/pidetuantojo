import { doc, getDoc, setDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { PrinterConfig, SavePrinterConfigData } from '@/types';

// Una sola impresora por ahora (sin estaciones cocina/bar/caja)
export const MAIN_PRINTER_ID = 'main';

function printerRef(restaurantId: string) {
  return doc(db, 'restaurants', restaurantId, 'printers', MAIN_PRINTER_ID);
}

export const printersService = {
  async getMain(restaurantId: string): Promise<PrinterConfig | null> {
    const snap = await getDoc(printerRef(restaurantId));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as PrinterConfig) : null;
  },

  async saveMain(restaurantId: string, data: SavePrinterConfigData): Promise<void> {
    const now = new Date().toISOString();
    const existing = await getDoc(printerRef(restaurantId));
    await setDoc(
      printerRef(restaurantId),
      {
        ...data,
        id: MAIN_PRINTER_ID,
        restaurantId,
        isActive: true,
        updatedAt: now,
        ...(existing.exists() ? {} : { createdAt: now }),
      },
      { merge: true }
    );
  },
};
