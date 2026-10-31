// Rutas de colecciones del libro contable y utilidades de escritura. Sin dependencias de Firebase.
export const LEDGER_COLLECTIONS = {
  accounts: 'ledgerAccounts',
  rules: 'accountingRules',
  entries: 'journalEntries',
  lines: 'journalLines',
} as const;

export const JOURNAL_SEQUENCE = 'journal';
export const JOURNAL_PREFIX = 'CC';

export function ledgerCollectionPath(
  restaurantId: string,
  name: keyof typeof LEDGER_COLLECTIONS
): string {
  return `restaurants/${restaurantId}/${LEDGER_COLLECTIONS[name]}`;
}

/** Firestore rechaza `undefined`: lo quita de forma superficial. */
export function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
