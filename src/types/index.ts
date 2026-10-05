// ===== USUARIOS =====

// `restaurant_view` es el nombre anterior de `restaurant_employee`: se acepta hasta migrar (Fase 7).
export type UserRole = 'super_admin' | 'restaurant_admin' | 'restaurant_employee' | 'restaurant_view';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  restaurantId?: string;
  isActive: boolean;
  // Solo empleados: permisos que le dio el admin (o fullAccess = todos los del plan)
  grantedPermissions?: string[];
  fullAccess?: boolean;
  // Calculado SOLO en el servidor (src/lib/permissions/server.ts). Lo leen la UI y firestore.rules.
  effectivePermissions?: string[];
  createdAt: string;
  updatedAt: string;
}

// ===== PLANES =====

/** plans/{planId} — lo crea el super admin; cada restaurante tiene uno. */
export interface Plan {
  id: string;
  name: string;
  description: string;
  // COP (informativo por ahora; sin cobro en la plataforma)
  price: number;
  billingPeriod: 'monthly' | 'yearly';
  // Claves del catálogo src/constants/permissions.ts (incluye features.*)
  permissions: string[];
  limits?: { maxEmployees?: number };
  // Los planes inactivos no se ofrecen a restaurantes nuevos
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type SavePlanData = Pick<Plan, 'name' | 'description' | 'price' | 'billingPeriod' | 'permissions' | 'isActive' | 'sortOrder' | 'limits'>;

// ===== CATEGORÍAS DE RESTAURANTE =====

/** restaurantCategories/{id} — administradas solo por el super admin. */
export interface RestaurantCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SaveRestaurantCategoryData = Pick<RestaurantCategory, 'name' | 'slug' | 'sortOrder' | 'isActive'> & { icon?: string };

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
  // IDs de PaymentMethodConfig permitidos. undefined = todos los activos.
  allowedPaymentMethodIds?: string[];
}

export interface DeliveryMethods {
  recoger?: DeliveryMethodConfig;
  domicilio?: DeliveryMethodConfig;
  mesa?: Pick<DeliveryMethodConfig, 'isActive' | 'allowedPaymentMethodIds'>;
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
  // Categorías (IDs de restaurantCategories — 1 a 3)
  categoryIds?: string[];
  /** @deprecated usar categoryIds. Se mantiene para migración. */
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
  tiktok?: string;
  twitter?: string;
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
  // Plan contratado (sin planId = restaurante anterior al sistema de planes: acceso completo)
  planId?: string;
  planName?: string;
  planAssignedAt?: string;
  subscriptionStartDate?: string; // ISO 8601 — when plan was last activated/renewed
  // Funcionalidades del plan (features.*), copiadas por el servidor: el menú público las lee sin sesión
  planFeatures?: string[];
  // Programa de fidelidad ("cada N pedidos, un premio"). Requiere features.promotions_advanced
  loyalty?: LoyaltyConfig;
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
  // id del Adicional (el servidor lo usa para validar el precio; pedidos viejos no lo tienen)
  id?: string;
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
  // Precio de lista: (unitPrice + adicionales) × cantidad, sin descuentos
  subtotal: number;
  additionals: Additional[];
  specialInstructions?: string;
  // Descuento de promociones sobre esta línea (precio tachado, 2x1, combo)
  discount?: number;
  promotionName?: string;
  // Producto de regalo de una promoción (precio 0)
  isGift?: boolean;
}

export type OrderDeliveryType = 'recoger' | 'domicilio' | 'mesa';

/**
 * Foto de una promoción aplicada al pedido: si después editan o borran la promoción,
 * el pedido sigue mostrando lo que se cobró.
 */
export interface AppliedPromotion {
  promotionId: string;
  name: string;
  type: PromotionType | 'loyalty';
  // Valor descontado (en domicilio gratis: el valor del domicilio; en regalos: 0)
  amount: number;
  couponCode?: string;
  // Texto corto: "2x1 en Empanadas", "Regalo: Gaseosa"
  detail?: string;
}

export interface Order {
  id: string;
  restaurantId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  // Teléfono normalizado (10 dígitos): identifica al cliente para promociones y fidelidad
  customerPhoneKey?: string;
  customerAddress?: string;
  barrio?: string;
  deliveryType?: OrderDeliveryType;
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
  // Montos (ver getOrderTotals): subtotal = productos a precio de lista · discount = promociones
  // total = subtotal − discount + deliveryFee
  subtotal: number;
  discount?: number;
  total: number;
  appliedPromotions?: AppliedPromotion[];
  // Domicilio gratis por promoción (deliveryFee queda en 0)
  freeDelivery?: boolean;
  couponCode?: string;
  // El cliente canjeó su premio de fidelidad en este pedido
  loyaltyRedeemed?: boolean;
  statusId: string;
  notes?: string;
  internalNote?: string;
  location?: { lat: number; lng: number };
  assignedDriver?: AssignedDriver;
  // Impresión de comanda (QZ Tray). 'printing' actúa como candado contra doble click.
  printStatus?: OrderPrintStatus;
  // Último trabajo de impresión encolado: los anteriores se descartan (evita duplicados al reintentar)
  printJobId?: string;
  printQueuedAt?: string;
  printingStartedAt?: string;
  printedAt?: string;
  printCount?: number;
  printError?: string;
  // Soft delete — auditoría
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
  createdAt: string;
  updatedAt: string;
}

// queued: en la cola esperando a la estación de impresión · printing: la estación lo está imprimiendo
export type OrderPrintStatus = 'queued' | 'printing' | 'printed' | 'error';

// ===== COLA DE IMPRESIÓN =====
// Cualquier dispositivo (tablet, celular, PC) encola; la "estación" (PC con QZ Tray) imprime.

export type PrintJobStatus = 'pending' | 'printing' | 'done' | 'failed' | 'superseded';

/** restaurants/{restaurantId}/printJobs/{jobId} */
export interface PrintJob {
  id: string;
  restaurantId: string;
  orderId: string;
  orderNumber: string;
  // Por ahora 'main'; preparado para cocina/bar/caja
  station: string;
  status: PrintJobStatus;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: string;
  claimedBy?: string;
  claimedAt?: string;
  completedAt?: string;
  error?: string;
}

/** restaurants/{restaurantId}/printStations/{stationId} — "latido" de la PC que imprime. */
export interface PrintStation {
  id: string;
  restaurantId: string;
  lastSeenAt: string;
  qzConnected: boolean;
  printerName?: string;
  userEmail?: string;
}

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
  'items' | 'subtotal' | 'discount' | 'total' | 'customerName' | 'customerPhone' |
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

// ===== PROMOCIONES =====
// Plan y reglas de negocio: docs/promociones.md

/**
 * - item_discount:  precio tachado en productos / categorías / todo el menú
 * - order_discount: descuento al total de productos (con pedido mínimo)
 * - free_delivery:  domicilio gratis (con pedido mínimo)
 * - bundle:         NxM (2x1, 3x2) en productos / categorías
 * - combo:          varios productos juntos por un precio fijo
 * - gift:           producto de regalo con la compra
 */
export type PromotionType = 'item_discount' | 'order_discount' | 'free_delivery' | 'bundle' | 'combo' | 'gift';

// percent: % de descuento · amount: $ de descuento · fixed_price: precio final (solo item_discount)
export type DiscountKind = 'percent' | 'amount' | 'fixed_price';

export interface PromotionTarget {
  scope: 'all' | 'categories' | 'products';
  categoryIds?: string[];
  productIds?: string[];
}

export interface ComboComponent {
  productId: string;
  quantity: number;
}

/** Cuándo aplica (hora de Colombia). Campos vacíos = sin restricción. */
export interface PromotionSchedule {
  // YYYY-MM-DD (inclusive)
  startDate?: string;
  endDate?: string;
  // 0 = domingo … 6 = sábado
  daysOfWeek?: number[];
  // HH:mm — si endTime < startTime la franja cruza la medianoche
  startTime?: string;
  endTime?: string;
}

/** restaurants/{restaurantId}/promotions/{promotionId} */
export interface Promotion {
  id: string;
  restaurantId: string;
  // Título visible para el cliente
  name: string;
  description?: string;
  image?: string;
  type: PromotionType;

  // item_discount / order_discount
  discountKind?: DiscountKind;
  discountValue?: number;
  // Tope del descuento en $ (descuentos en %)
  maxDiscount?: number;
  // item_discount / bundle
  target?: PromotionTarget;
  // bundle: lleva `buyQuantity`, paga `payQuantity`
  buyQuantity?: number;
  payQuantity?: number;
  // combo
  comboItems?: ComboComponent[];
  comboPrice?: number;
  // gift
  giftProductId?: string;
  giftQuantity?: number;

  // Condiciones
  schedule?: PromotionSchedule;
  // Mínimo de productos (después de los descuentos por producto)
  minSubtotal?: number;
  // Formas de entrega en las que aplica (vacío = todas)
  deliveryTypes?: OrderDeliveryType[];
  // Cupón: si existe, solo aplica escribiendo el código (se guarda en mayúsculas)
  couponCode?: string;
  firstOrderOnly?: boolean;
  // Límite total de usos ("las primeras 50") y por cliente (teléfono)
  maxUses?: number;
  maxUsesPerCustomer?: number;
  // Solo descuentos al total: si es false, no descuenta sobre productos que ya están en oferta
  stackable?: boolean;

  // Mostrar en el banner del menú público
  showInMenu: boolean;
  // Pausada / activa (sin borrar)
  isActive: boolean;
  // Lo incrementa SOLO el servidor al crear pedidos
  usesCount: number;
  createdAt: string;
  updatedAt: string;
}

export type SavePromotionData = Omit<Promotion, 'id' | 'restaurantId' | 'usesCount' | 'createdAt' | 'updatedAt'>;

// ===== FIDELIDAD =====

/** restaurant.loyalty — "cada N pedidos entregados o pagados, un premio". */
export interface LoyaltyConfig {
  isActive: boolean;
  // Pedidos que hay que completar para ganar el premio
  ordersRequired: number;
  // Solo cuentan pedidos con al menos este valor en productos
  minSubtotal?: number;
  rewardKind: 'percent' | 'amount';
  rewardValue: number;
  // Tope del premio en % (ej: 100% hasta $30.000 = "pedido gratis hasta $30.000")
  maxReward?: number;
}

// ===== CLIENTES =====

/**
 * restaurants/{restaurantId}/customers/{phoneKey} — lo escribe SOLO el servidor al crear pedidos.
 * La identidad es el teléfono normalizado (débil: ver docs/promociones.md).
 */
export interface Customer {
  id: string;
  restaurantId: string;
  phone: string;
  name: string;
  ordersCount: number;
  firstOrderAt: string;
  lastOrderAt: string;
  // Usos por promoción (para "1 por cliente")
  promoUses?: Record<string, number>;
  // Autorización de tratamiento de datos para promociones (Ley 1581 de 2012)
  marketingOptIn?: boolean;
  marketingOptInAt?: string;
  // Último canje de fidelidad: los sellos se cuentan desde aquí
  loyaltyRedeemedAt?: string;
  loyaltyRedemptions?: number;
  updatedAt: string;
}
