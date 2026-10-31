export const QUERY_KEYS = {
  restaurants: ['restaurants'] as const,
  restaurant: (id: string) => ['restaurants', id] as const,
  restaurantBySlug: (slug: string) => ['restaurants', 'slug', slug] as const,

  categories: (restaurantId: string) => ['categories', restaurantId] as const,
  category: (id: string) => ['categories', id] as const,

  products: (restaurantId: string) => ['products', restaurantId] as const,
  product: (id: string) => ['products', id] as const,

  orders: (restaurantId: string) => ['orders', restaurantId] as const,
  order: (id: string) => ['orders', id] as const,

  orderStatuses: (restaurantId: string) => ['order-statuses', restaurantId] as const,

  adicionales: (restaurantId: string) => ['adicionales', restaurantId] as const,

  deliveryZones: (restaurantId: string) => ['deliveryZones', restaurantId] as const,

  domiciliarios: (restaurantId: string) => ['domiciliarios', restaurantId] as const,

  mesas: (restaurantId: string) => ['mesas', restaurantId] as const,

  printer: (restaurantId: string) => ['printer', restaurantId] as const,

  promotions: (restaurantId: string) => ['promotions', restaurantId] as const,

  leads: ['leads'] as const,

  plans: ['plans'] as const,
  plan: (id: string) => ['plans', id] as const,

  restaurantCategories: ['restaurant-categories'] as const,
  restaurantCategory: (id: string) => ['restaurant-categories', id] as const,

  waConfig: (restaurantId: string) => ['waConfig', restaurantId] as const,

  cashSettings: (restaurantId: string) => ['cash', 'settings', restaurantId] as const,
  cashActivation: (restaurantId: string) => ['cash', 'activation', restaurantId] as const,
  cashCurrentShift: (restaurantId: string) => ['cash', 'current-shift', restaurantId] as const,
  cashShiftMovements: (restaurantId: string, shiftId: string) =>
    ['cash', 'shift-movements', restaurantId, shiftId] as const,
  cashRegisters: (restaurantId: string) => ['cash', 'registers', restaurantId] as const,
  cashRegisterBalance: (restaurantId: string, registerId: string) =>
    ['cash', 'register-balance', restaurantId, registerId] as const,
  cashShifts: (restaurantId: string, status: string) =>
    ['cash', 'shifts', restaurantId, status] as const,
  cashPendingApprovals: (restaurantId: string) => ['cash', 'pending', restaurantId] as const,
  cashClosing: (restaurantId: string, shiftId: string) =>
    ['cash', 'closing', restaurantId, shiftId] as const,
  cashOwnPendingClose: (restaurantId: string, uid: string) =>
    ['cash', 'own-pending-close', restaurantId, uid] as const,
  ledgerAccounts: (restaurantId: string) => ['ledger', 'accounts', restaurantId] as const,
} as const;
