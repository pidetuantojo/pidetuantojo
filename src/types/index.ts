// ===== USUARIOS =====

export type UserRole = 'super_admin' | 'restaurant_admin' | 'restaurant_view';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  restaurantId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== RESTAURANTE =====

export interface RestaurantTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
}

export interface DaySchedule {
  open: string;  // "09:00"
  close: string; // "19:00"
}

// 0 = domingo, 1 = lunes, ..., 6 = sábado
// null = cerrado ese día
export type OpeningHours = {
  [day: number]: DaySchedule | null | undefined;
};

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  phone: string;
  logo: string;
  bannerImage?: string;
  theme: RestaurantTheme;
  // Categoría (tipo de cocina)
  category?: string;
  // Ubicación
  address?: string;
  department?: string;
  city?: string;
  mapUrl?: string;
  mapEmbed?: string;
  // Redes sociales
  instagram?: string;
  facebook?: string;
  // Formato del menú público
  menuLayout?: 'cards' | 'list';
  // Modo de domicilios
  deliveryMode?: 'manual' | 'zones';
  // Horario de atención
  openingHours?: OpeningHours;
  adminUserId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateRestaurantData = Omit<Restaurant, 'id' | 'createdAt' | 'updatedAt'> & {
  adminEmail: string;
  adminPassword: string;
  adminName: string;
};

export type UpdateRestaurantData = Partial<
  Omit<Restaurant, 'id' | 'slug' | 'adminUserId' | 'createdAt' | 'updatedAt'>
>;

// ===== CATEGORÍAS =====

export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateCategoryData = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCategoryData = Partial<Omit<Category, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>>;

// ===== ADICIONALES =====

export interface Adicional {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateAdicionalData = Pick<Adicional, 'name' | 'price' | 'isActive'>;
export type UpdateAdicionalData = Partial<Pick<Adicional, 'name' | 'price' | 'isActive'>>;

// ===== PRODUCTOS =====

// Used only in cart / order storage (resolved name+price, not DB entity)
export interface Additional {
  name: string;
  price: number;
}

export interface Product {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  tag?: string;
  adicionalIds: string[];
  isActive: boolean;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateProductData = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateProductData = Partial<Omit<Product, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>>;

// ===== ESTADOS DE PEDIDO =====

export interface OrderStatus {
  id: string;
  restaurantId: string;
  name: string;
  code: string;
  color: string;
  sortOrder: number;
  isBase: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateOrderStatusData = Omit<OrderStatus, 'id' | 'createdAt' | 'updatedAt'>;

// Estados base que se crean automáticamente al crear un restaurante
export const BASE_ORDER_STATUSES: Omit<OrderStatus, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Recibido', code: 'received', color: '#6b7280', sortOrder: 1, isBase: true, isActive: true },
  { name: 'Confirmado', code: 'confirmed', color: '#3b82f6', sortOrder: 2, isBase: true, isActive: true },
  { name: 'En preparación', code: 'preparing', color: '#f59e0b', sortOrder: 3, isBase: true, isActive: true },
  { name: 'Listo', code: 'ready', color: '#10b981', sortOrder: 4, isBase: true, isActive: true },
  { name: 'Entregado', code: 'delivered', color: '#059669', sortOrder: 5, isBase: true, isActive: true },
  { name: 'Cancelado', code: 'cancelled', color: '#ef4444', sortOrder: 6, isBase: true, isActive: true },
];

// ===== PEDIDOS =====

export interface OrderItem {
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  additionals: Additional[];
  specialInstructions?: string;
}

export interface Order {
  id: string;
  restaurantId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  barrio?: string;
  deliveryType?: 'recoger' | 'domicilio';
  deliveryFee?: number;
  paymentMethod: string;
  isPaid?: boolean;
  items: OrderItem[];
  subtotal: number;
  total: number;
  statusId: string;
  notes?: string;
  internalNote?: string;
  location?: { lat: number; lng: number };
  assignedDriver?: { id: string; name: string; code: string; phone: string };
  createdAt: string;
  updatedAt: string;
}

// ===== ZONAS DE DOMICILIO =====

export interface DeliveryZone {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateDeliveryZoneData = Omit<DeliveryZone, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDeliveryZoneData = Partial<Pick<DeliveryZone, 'name' | 'price' | 'isActive' | 'sortOrder'>>;

// ===== DOMICILIARIOS =====

export interface Domiciliario {
  id: string;
  restaurantId: string;
  name: string;
  code: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateDomiciliarioData = Omit<Domiciliario, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDomiciliarioData = Partial<Pick<Domiciliario, 'name' | 'code' | 'phone' | 'isActive'>>;

export type CreateOrderData = Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>;
export type UpdateOrderData = Partial<Pick<Order,
  'statusId' | 'notes' | 'deliveryFee' | 'isPaid' | 'internalNote' |
  'items' | 'subtotal' | 'total' | 'customerName' | 'customerPhone' |
  'customerAddress' | 'barrio' | 'deliveryType' | 'paymentMethod' | 'assignedDriver'
>>;
