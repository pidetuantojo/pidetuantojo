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

export interface DeliveryMethodConfig {
  isActive: boolean;
  allowScheduled?: boolean;
}

export interface DeliveryMethods {
  recoger?: DeliveryMethodConfig;
  domicilio?: DeliveryMethodConfig;
  mesa?: Pick<DeliveryMethodConfig, 'isActive'>;
}

// ===== MÉTODOS DE PAGO =====

export type PaymentMethodType =
  | 'efectivo'
  | 'datafono'
  | 'nequi'
  | 'daviplata'
  | 'breb'
  | 'bancolombia'
  | 'otro_banco';

export interface PaymentMethodConfig {
  id: string;
  type: PaymentMethodType;
  isActive: boolean;
  // Número de celular, alias BreB o número de cuenta (según el tipo)
  account?: string;
  // Solo para 'otro_banco'
  bankName?: string;
}

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
  // Si está cerrado, ¿se aceptan pedidos programados para cuando abra?
  allowScheduledWhenClosed?: boolean;
  // Métodos de entrega
  deliveryMethods?: DeliveryMethods;
  // Métodos de pago (efectivo, datáfono y cuentas para transferir)
  paymentMethods?: PaymentMethodConfig[];
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
  deliveryType?: 'recoger' | 'domicilio' | 'mesa';
  tableId?: string;
  tableName?: string;
  // Programación: false/ausente = inmediato. scheduledFor en ISO 8601
  isScheduled?: boolean;
  scheduledFor?: string;
  deliveryFee?: number;
  // Etiqueta visible del método (ej: "Nequi"); Contabilidad agrupa por este valor
  paymentMethod: string;
  paymentMethodType?: PaymentMethodType;
  // Cuenta a la que el cliente transfirió (si aplica)
  paymentAccount?: string;
  isPaid?: boolean;
  items: OrderItem[];
  subtotal: number;
  total: number;
  statusId: string;
  notes?: string;
  internalNote?: string;
  location?: { lat: number; lng: number };
  assignedDriver?: AssignedDriver;
  // Impresión de comanda (QZ Tray). 'printing' actúa como candado contra doble click.
  printStatus?: OrderPrintStatus;
  printingStartedAt?: string;
  printedAt?: string;
  printCount?: number;
  printError?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderPrintStatus = 'printing' | 'printed' | 'error';

// ===== IMPRESORAS (QZ Tray) =====

export type PaperWidth = 58 | 80;
// cp850: soporta tildes y ñ · ascii: sin tildes (para impresoras que muestran caracteres raros)
export type PrinterEncoding = 'cp850' | 'ascii';

/** restaurants/{restaurantId}/printers/{id} — por ahora una sola ("main") para todo el pedido. */
export interface PrinterConfig {
  id: string;
  restaurantId: string;
  // Nombre exacto reportado por QZ Tray (qz.printers.find())
  name: string;
  paperWidth: PaperWidth;
  encoding: PrinterEncoding;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SavePrinterConfigData = Pick<PrinterConfig, 'name' | 'paperWidth' | 'encoding'>;

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
  // Solo domiciliarios individuales; las empresas no tienen código
  code?: string;
  // Celular del domiciliario, o de la empresa (a donde se envía el pedido)
  phone: string;
  // true = empresa de domicilios
  isCompany?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateDomiciliarioData = Omit<Domiciliario, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDomiciliarioData = Partial<Pick<Domiciliario, 'name' | 'code' | 'phone' | 'isCompany' | 'isActive'>>;

/** Domiciliario (o empresa) asignado a un pedido: copia de sus datos al momento de asignar. */
export interface AssignedDriver {
  id: string;
  name: string;
  phone: string;
  code?: string;
  isCompany?: boolean;
  // Solo empresas: nombre o código de quien tomó el pedido (texto libre, para trazabilidad)
  courierName?: string;
}

export type CreateOrderData = Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>;
export type UpdateOrderData = Partial<Pick<Order,
  'statusId' | 'notes' | 'deliveryFee' | 'isPaid' | 'internalNote' |
  'items' | 'subtotal' | 'total' | 'customerName' | 'customerPhone' |
  'customerAddress' | 'barrio' | 'deliveryType' | 'paymentMethod' | 'assignedDriver' |
  'tableId' | 'tableName' | 'isScheduled' | 'scheduledFor' |
  'paymentMethodType' | 'paymentAccount'
>>;

// ===== MESAS =====

export interface Mesa {
  id: string;
  restaurantId: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateMesaData = Omit<Mesa, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateMesaData = Partial<Pick<Mesa, 'name' | 'isActive' | 'sortOrder'>>;
