import { cashApi } from '../services/cash.api';
import type {
  ManualMovementInput,
  OpenShiftInput,
  ShiftAck,
  ShiftRow,
  SubmitCountInput,
  MovementRow,
} from '../types/cash.types';

import { useCashMutation } from './useCashMutation';

/** Acciones del cajero sobre su turno: abrir, mover, reversar, iniciar cierre y enviar el conteo. */
export function useShiftActions(restaurantId: string) {
  const open = useCashMutation<OpenShiftInput, ShiftRow>(restaurantId, {
    signature: (i) => `open:${JSON.stringify(i)}`,
    call: (i, key) => cashApi.openShift(i, key),
    successMessage: 'Turno abierto',
  });

  const move = useCashMutation<{ shiftId: string; input: ManualMovementInput }, MovementRow>(
    restaurantId,
    {
      signature: (i) => `move:${JSON.stringify(i)}`,
      call: (i, key) => cashApi.createShiftMovement(i.shiftId, i.input, key),
      successMessage: 'Movimiento registrado',
    }
  );

  const reverse = useCashMutation<{ movementId: string; reason: string }, MovementRow>(
    restaurantId,
    {
      signature: (i) => `reverse:${JSON.stringify(i)}`,
      call: (i, key) => cashApi.reverseMovement(i.movementId, i.reason, key),
      successMessage: 'Movimiento reversado',
    }
  );

  const startClose = useCashMutation<string, ShiftAck>(restaurantId, {
    signature: (shiftId) => `start-close:${shiftId}`,
    call: (shiftId, key) => cashApi.startClose(shiftId, key),
  });

  // El error de justificación lo maneja la pantalla con un mensaje neutro (sin cifras)
  const submitCount = useCashMutation<{ shiftId: string; input: SubmitCountInput }, ShiftAck>(
    restaurantId,
    {
      signature: (i) => `count:${JSON.stringify(i)}`,
      call: (i, key) => cashApi.submitCount(i.shiftId, i.input, key),
      toastOnError: false,
    }
  );

  return { open, move, reverse, startClose, submitCount };
}
