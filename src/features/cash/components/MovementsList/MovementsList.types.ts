import type { MovementRow } from '../../types/cash.types';

export interface MovementsListProps {
  movements: readonly MovementRow[];
  emptyText?: string;
  /** Si se pasa, las filas reversables muestran el botón "Reversar". */
  onReverse?: (movement: MovementRow) => void;
}
