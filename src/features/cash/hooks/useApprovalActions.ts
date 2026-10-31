import { cashApi } from '../services/cash.api';
import type {
  ApproveCloseInput,
  CashClosing,
  MovementRow,
  WithdrawalDecisionInput,
} from '../types/cash.types';

import { useCashMutation } from './useCashMutation';

/** Acciones de supervisor: decidir retiros parciales y aprobar cierres. */
export function useApprovalActions(restaurantId: string) {
  const decideWithdrawal = useCashMutation<
    { shiftId: string; movementId: string; input: WithdrawalDecisionInput },
    MovementRow
  >(restaurantId, {
    signature: (i) => `withdrawal:${JSON.stringify(i)}`,
    call: (i, key) => cashApi.decideWithdrawal(i.shiftId, i.movementId, i.input, key),
    successMessage: 'Decisión registrada',
  });

  const approveClose = useCashMutation<{ shiftId: string; input: ApproveCloseInput }, CashClosing>(
    restaurantId,
    {
      signature: (i) => `approve:${JSON.stringify(i)}`,
      call: (i, key) => cashApi.approveClose(i.shiftId, i.input, key),
      successMessage: 'Cierre aprobado',
    }
  );

  return { decideWithdrawal, approveClose };
}
