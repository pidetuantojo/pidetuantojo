'use client';

import { useEffect, useState } from 'react';

/**
 * Hora actual que se refresca cada `intervalMs`: las promociones por horario
 * aparecen y desaparecen sin recargar la página.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
