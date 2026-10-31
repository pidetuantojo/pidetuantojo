// Rutas de colecciones de caja. Sin dependencias de Firebase.
export const CASH_COLLECTIONS = {
  registers: 'cashRegisters',
  shifts: 'cashShifts',
  movements: 'cashMovements',
  closings: 'cashClosings',
  locks: 'cashShiftLocks',
  settings: 'cashSettings',
  balances: 'cashRegisterBalances',
} as const;

export const SETTINGS_DOC_ID = 'default';

export function cashCollectionPath(restaurantId: string, name: keyof typeof CASH_COLLECTIONS) {
  return `restaurants/${restaurantId}/${CASH_COLLECTIONS[name]}`;
}

export function cashDocPath(restaurantId: string, name: keyof typeof CASH_COLLECTIONS, id: string) {
  return `${cashCollectionPath(restaurantId, name)}/${id}`;
}

/** Candados de unicidad: una caja y un cajero solo pueden tener un turno abierto. */
export const registerLockId = (registerId: string) => `register_${registerId}`;
export const cashierLockId = (uid: string) => `cashier_${uid}`;

/** Consecutivos por familia de movimiento. */
export const MOVEMENT_SEQUENCES = {
  RC: 'cash_rc',
  CE: 'cash_ce',
  TR: 'cash_tr',
  RV: 'cash_rv',
} as const;
