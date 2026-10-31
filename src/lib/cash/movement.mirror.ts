// Espejo de un traslado: el mismo hecho visto desde la caja contraparte (la general).
// Sin turno (nunca cuenta en el esperado de un turno), sentido contrario y el MISMO asiento.
import type { CashMovement } from './cash.types';
import { oppositeDirection } from './movement.helpers';

/** `original` ya debe traer `counterpartRegisterId` y `transferId`. */
export function buildMirrorMovement(original: CashMovement, mirrorId: string): CashMovement {
  const mirror: CashMovement = {
    ...original,
    id: mirrorId,
    direction: oppositeDirection(original.direction),
    registerId: original.counterpartRegisterId as string,
    counterpartRegisterId: original.registerId,
    shiftId: null,
    mirrorOfMovementId: original.id,
  };
  delete mirror.reversedByMovementId;
  delete mirror.reversesMovementId;
  delete mirror.approvedBy;
  delete mirror.decisionNote;
  return mirror;
}
