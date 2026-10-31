import type { PaymentMethodConfig } from '@/types';

import type { ManualMovementType } from '../../types/cash.types';

export interface ManualMovementDialogProps {
  type: ManualMovementType;
  restaurantId: string;
  shiftId: string;
  paymentMethods: PaymentMethodConfig[] | undefined;
  onClose: () => void;
}
