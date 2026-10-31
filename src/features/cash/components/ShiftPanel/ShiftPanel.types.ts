import type { PaymentMethodConfig } from '@/types';

import type { CashRegister, CurrentShift } from '../../types/cash.types';

export interface ShiftPanelProps {
  restaurantId: string;
  shift: CurrentShift;
  register: CashRegister | undefined;
  paymentMethods: PaymentMethodConfig[] | undefined;
  canReverse: boolean;
  /** Se llama tras iniciar el cierre para pasar a la pantalla de conteo. */
  onCloseStarted: () => void;
}
