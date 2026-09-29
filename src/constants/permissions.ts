// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de permisos (fuente de verdad). Plan: docs/plan-roles-permisos.md §4
//
// - `kind: 'user'`    → acciones de usuarios; se asignan a planes Y a empleados.
// - `kind: 'feature'` → capacidades del restaurante (menú público, módulos); solo en planes.
// - `requires`        → dependencias: al otorgar un permiso se agregan automáticamente.
// - `*.view`          → controla si el módulo aparece en el menú y si su ruta es accesible.
//
// Para agregar un permiso: añadirlo aquí, protegerlo en la UI (<Can>) y en firestore.rules.
// ─────────────────────────────────────────────────────────────────────────────

export interface PermissionDefinition {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly requires?: readonly string[];
}

export interface PermissionModule {
  readonly id: string;
  readonly label: string;
  readonly kind: 'user' | 'feature';
  // Ruta principal del módulo en el dashboard (si tiene)
  readonly route?: string;
  readonly permissions: readonly PermissionDefinition[];
}

export const PERMISSION_MODULES = [
  {
    id: 'dashboard', label: 'Inicio', kind: 'user', route: '/dashboard',
    permissions: [
      { key: 'dashboard.view', label: 'Ver la pantalla de inicio' },
    ],
  },
  {
    id: 'orders', label: 'Pedidos', kind: 'user', route: '/dashboard/pedidos',
    permissions: [
      { key: 'orders.view', label: 'Ver pedidos', description: 'Tablero de pedidos y detalle de cada pedido' },
      { key: 'orders.create', label: 'Crear pedido manual', requires: ['orders.view', 'products.view'] },
      { key: 'orders.edit', label: 'Editar pedidos', description: 'Productos, cliente, entrega, pago y programación', requires: ['orders.view', 'products.view'] },
      { key: 'orders.change_status', label: 'Cambiar estado del pedido', requires: ['orders.view'] },
      { key: 'orders.set_delivery_fee', label: 'Editar valor de domicilio', requires: ['orders.view'] },
      { key: 'orders.mark_paid', label: 'Marcar pagado / pendiente', requires: ['orders.view'] },
      { key: 'orders.manage_notes', label: 'Nota interna del pedido', requires: ['orders.view'] },
      { key: 'orders.assign_driver', label: 'Asignar domiciliario', description: 'Asignar, quitar y enviar el pedido por WhatsApp', requires: ['orders.view'] },
      { key: 'orders.print', label: 'Imprimir comanda', requires: ['orders.view', 'features.printing'] },
    ],
  },
  {
    id: 'order_statuses', label: 'Estados de pedido', kind: 'user', route: '/dashboard/estados',
    permissions: [
      { key: 'order_statuses.view', label: 'Ver estados' },
      { key: 'order_statuses.create', label: 'Crear estados', requires: ['order_statuses.view'] },
      { key: 'order_statuses.update', label: 'Editar, activar y reordenar estados', requires: ['order_statuses.view'] },
      { key: 'order_statuses.delete', label: 'Eliminar estados', requires: ['order_statuses.view'] },
    ],
  },
  {
    id: 'products', label: 'Productos', kind: 'user', route: '/dashboard/productos',
    permissions: [
      { key: 'products.view', label: 'Ver productos' },
      { key: 'products.create', label: 'Crear productos', requires: ['products.view', 'categories.view'] },
      { key: 'products.update', label: 'Editar productos', description: 'Datos, imagen, orden y adicionales', requires: ['products.view', 'categories.view'] },
      { key: 'products.toggle_availability', label: 'Marcar disponible / agotado', requires: ['products.view'] },
      { key: 'products.delete', label: 'Eliminar productos', requires: ['products.view'] },
    ],
  },
  {
    id: 'categories', label: 'Categorías', kind: 'user', route: '/dashboard/categorias',
    permissions: [
      { key: 'categories.view', label: 'Ver categorías' },
      { key: 'categories.create', label: 'Crear categorías', requires: ['categories.view'] },
      { key: 'categories.update', label: 'Editar y activar categorías', requires: ['categories.view'] },
      { key: 'categories.delete', label: 'Eliminar categorías', requires: ['categories.view'] },
    ],
  },
  {
    id: 'addons', label: 'Adicionales', kind: 'user', route: '/dashboard/adicionales',
    permissions: [
      { key: 'addons.view', label: 'Ver adicionales' },
      { key: 'addons.create', label: 'Crear adicionales', requires: ['addons.view'] },
      { key: 'addons.update', label: 'Editar adicionales', requires: ['addons.view'] },
      { key: 'addons.delete', label: 'Eliminar adicionales', requires: ['addons.view'] },
    ],
  },
  {
    id: 'accounting', label: 'Contabilidad', kind: 'user', route: '/dashboard/contabilidad',
    permissions: [
      { key: 'accounting.view', label: 'Ver contabilidad', description: 'Resumen de ventas y pedidos por fecha' },
      { key: 'accounting.export', label: 'Exportar a Excel', requires: ['accounting.view'] },
    ],
  },
  {
    id: 'payment_methods', label: 'Métodos de pago', kind: 'user', route: '/dashboard/pagos',
    permissions: [
      { key: 'payment_methods.view', label: 'Ver métodos de pago' },
      { key: 'payment_methods.manage', label: 'Configurar métodos y cuentas', requires: ['payment_methods.view'] },
    ],
  },
  {
    id: 'delivery_methods', label: 'Métodos de entrega', kind: 'user', route: '/dashboard/entrega',
    permissions: [
      { key: 'delivery_methods.view', label: 'Ver métodos de entrega' },
      { key: 'delivery_methods.manage', label: 'Activar métodos y programación', requires: ['delivery_methods.view'] },
      { key: 'tables.manage', label: 'Crear, editar y eliminar mesas', requires: ['delivery_methods.view', 'features.dine_in'] },
    ],
  },
  {
    id: 'drivers', label: 'Domiciliarios', kind: 'user', route: '/dashboard/domicilios/domiciliarios',
    permissions: [
      { key: 'drivers.view', label: 'Ver domiciliarios' },
      { key: 'drivers.create', label: 'Crear domiciliarios', requires: ['drivers.view'] },
      { key: 'drivers.update', label: 'Editar y activar domiciliarios', requires: ['drivers.view'] },
      { key: 'drivers.delete', label: 'Eliminar domiciliarios', requires: ['drivers.view'] },
    ],
  },
  {
    id: 'delivery_zones', label: 'Zonas de domicilio', kind: 'user', route: '/dashboard/domicilios/zonas',
    permissions: [
      { key: 'delivery_zones.view', label: 'Ver zonas', requires: ['features.delivery_zones'] },
      { key: 'delivery_zones.create', label: 'Crear zonas', requires: ['delivery_zones.view'] },
      { key: 'delivery_zones.update', label: 'Editar y activar zonas', requires: ['delivery_zones.view'] },
      { key: 'delivery_zones.delete', label: 'Eliminar zonas', requires: ['delivery_zones.view'] },
    ],
  },
  {
    id: 'settings', label: 'Configuración del restaurante', kind: 'user', route: '/dashboard/configuracion',
    permissions: [
      { key: 'settings.view', label: 'Ver configuración' },
      { key: 'settings.update_info', label: 'Información básica', description: 'Nombre, tagline, descripción, teléfono, categoría', requires: ['settings.view'] },
      { key: 'settings.update_branding', label: 'Marca y diseño', description: 'Logo, portada, colores, diseño del menú', requires: ['settings.view'] },
      { key: 'settings.update_location', label: 'Ubicación', description: 'Dirección, ciudad, mapa', requires: ['settings.view'] },
      { key: 'settings.update_social', label: 'Redes sociales', requires: ['settings.view'] },
      { key: 'settings.update_hours', label: 'Horario de atención', description: 'Incluye aceptar pedidos programados con el local cerrado', requires: ['settings.view'] },
      { key: 'settings.update_delivery_mode', label: 'Modo de domicilios', description: 'Manual o por zonas', requires: ['settings.view'] },
    ],
  },
  {
    id: 'printers', label: 'Impresoras', kind: 'user', route: '/dashboard/configuracion/impresoras',
    permissions: [
      { key: 'printers.view', label: 'Ver configuración de impresora', requires: ['features.printing'] },
      { key: 'printers.manage', label: 'Configurar y probar impresora', requires: ['printers.view'] },
      { key: 'print_station.run', label: 'Abrir la estación de impresión', description: 'El PC que imprime lo que se envía desde otros equipos', requires: ['features.printing'] },
    ],
  },
  {
    id: 'team', label: 'Equipo', kind: 'user', route: '/dashboard/equipo',
    permissions: [
      { key: 'team.view', label: 'Ver usuarios del restaurante' },
      { key: 'team.create', label: 'Crear usuarios', requires: ['team.view'] },
      { key: 'team.update', label: 'Editar usuarios y sus permisos', description: 'Solo puede otorgar permisos que él mismo tiene', requires: ['team.view'] },
      { key: 'team.reset_password', label: 'Cambiar contraseña de usuarios', requires: ['team.view'] },
      { key: 'team.delete', label: 'Eliminar usuarios', requires: ['team.view'] },
    ],
  },
  {
    id: 'features', label: 'Funcionalidades del plan', kind: 'feature',
    permissions: [
      { key: 'features.scheduled_orders', label: 'Pedidos programados', description: '"Programar para más tarde" y pedidos con el local cerrado' },
      { key: 'features.dine_in', label: 'Comer en el local', description: 'Opción de entrega en mesa y gestión de mesas' },
      { key: 'features.delivery_zones', label: 'Zonas de domicilio', description: 'Precio de domicilio por zona' },
      { key: 'features.payment_accounts', label: 'Cuentas de pago', description: 'Datáfono y transferencias (Nequi, Daviplata, BreB, bancos). Sin esto: solo efectivo' },
      { key: 'features.printing', label: 'Impresión de comandas', description: 'Impresora térmica y estación de impresión' },
      { key: 'features.delivery_companies', label: 'Empresas de domicilios', description: 'Registrar empresas y asignar su domiciliario' },
    ],
  },
] as const satisfies readonly PermissionModule[];

/** Cualquier permiso del catálogo (unión derivada: TypeScript rechaza claves inexistentes). */
export type Permission = (typeof PERMISSION_MODULES)[number]['permissions'][number]['key'];

/** Permisos que solo existen a nivel de plan/restaurante (no se asignan a empleados). */
export type FeaturePermission = Extract<Permission, `features.${string}`>;

/** Permisos asignables a usuarios. */
export type UserPermission = Exclude<Permission, FeaturePermission>;

/**
 * Plantillas para crear empleados rápido (Equipo). Se recortan a lo que incluya el plan.
 */
export const PERMISSION_TEMPLATES: readonly { id: string; label: string; description: string; permissions: readonly UserPermission[] }[] = [
  {
    id: 'cashier', label: 'Cajero', description: 'Pedidos, pagos, impresión y contabilidad',
    permissions: [
      'dashboard.view', 'orders.view', 'orders.create', 'orders.edit', 'orders.change_status',
      'orders.set_delivery_fee', 'orders.mark_paid', 'orders.manage_notes', 'orders.assign_driver',
      'orders.print', 'print_station.run', 'accounting.view', 'products.toggle_availability',
    ],
  },
  {
    id: 'kitchen', label: 'Cocina', description: 'Ver pedidos, cambiar estados e imprimir',
    permissions: ['orders.view', 'orders.change_status', 'orders.print', 'products.toggle_availability'],
  },
  {
    id: 'waiter', label: 'Mesero', description: 'Crear y seguir pedidos',
    permissions: ['orders.view', 'orders.create', 'orders.change_status', 'orders.manage_notes', 'orders.print'],
  },
  {
    id: 'delivery', label: 'Domicilios', description: 'Asignar domiciliarios y cobrar domicilio',
    permissions: ['orders.view', 'orders.change_status', 'orders.assign_driver', 'orders.set_delivery_fee', 'drivers.view'],
  },
];

/**
 * Permisos de los empleados creados antes de este sistema (rol `restaurant_view`):
 * equivalen a lo que podían hacer (pedidos sin crear/editar, contabilidad, estación de impresión).
 * Se usan como compatibilidad hasta migrar y como valor de la migración (Fase 7).
 */
export const LEGACY_EMPLOYEE_PERMISSIONS: readonly UserPermission[] = [
  'orders.view', 'orders.change_status', 'orders.set_delivery_fee', 'orders.mark_paid',
  'orders.manage_notes', 'orders.assign_driver', 'orders.print', 'accounting.view', 'print_station.run',
];
