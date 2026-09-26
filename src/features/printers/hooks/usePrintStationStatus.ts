'use client';

import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

import { isStationOnline } from '@/lib/printer/printLock';
import { MAIN_STATION_ID, stationRef } from '@/lib/printer/printQueue';
import type { PrintStation } from '@/types';

/** Estado en vivo de la estación de impresión (PC con QZ Tray que imprime la cola). */
export function usePrintStationStatus(restaurantId: string | undefined, stationId = MAIN_STATION_ID) {
  const [station, setStation] = useState<PrintStation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!restaurantId) return;
    return onSnapshot(
      stationRef(restaurantId, stationId),
      (snap) => {
        setStation(snap.exists() ? (snap.data() as PrintStation) : null);
        setLoaded(true);
      },
      () => setLoaded(true)
    );
  }, [restaurantId, stationId]);

  // Sin latidos nuevos, la estación pasa a "apagada" con el tiempo: recalcular periódicamente
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return { station, loaded, online: isStationOnline(station, now) };
}
