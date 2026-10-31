import type { ShiftRow } from '../../types/cash.types';

export interface ClosingDetailModalProps {
  restaurantId: string;
  shift: ShiftRow;
  registerName: string;
  onClose: () => void;
}
