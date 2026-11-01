// Rutas de colecciones de la caja menor. Sin dependencias de Firebase.
export const PETTY_COLLECTIONS = {
  expenses: 'pettyCashExpenses',
  reimbursements: 'pettyCashReimbursements',
  categories: 'pettyCashCategories',
} as const;

export const pettyCollectionPath = (restaurantId: string, name: keyof typeof PETTY_COLLECTIONS) =>
  `restaurants/${restaurantId}/${PETTY_COLLECTIONS[name]}`;

export const pettyDocPath = (
  restaurantId: string,
  name: keyof typeof PETTY_COLLECTIONS,
  id: string
) => `${pettyCollectionPath(restaurantId, name)}/${id}`;
