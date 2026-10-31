import type { CountMap, Denomination } from '@/lib/cash/cash.types';

export interface DenominationCounterProps {
  denominations: readonly Denomination[];
  /** Denominación → cantidad. Las que no aparecen valen 0. */
  value: CountMap;
  onChange: (value: CountMap) => void;
  /** Oculta el total del conteo (el esperado del sistema NUNCA se muestra en el cierre a ciegas). */
  hideTotal?: boolean;
  disabled?: boolean;
}
