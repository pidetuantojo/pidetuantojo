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

  leads: ['leads'] as const,
} as const;
