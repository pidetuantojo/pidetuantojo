export const ROUTES = {
  home: '/',
  login: '/login',
  registrarLocal: '/registrar-local',
  // Super admin
  admin: {
    root: '/admin',
    restaurants: '/admin/restaurantes',
    leads: '/admin/inscripciones',
  },
  // Restaurant dashboard
  dashboard: {
    root: '/dashboard',
    pedidos: '/dashboard/pedidos',
    estados: '/dashboard/estados',
    productos: '/dashboard/productos',
    categorias: '/dashboard/categorias',
    adicionales: '/dashboard/adicionales',
    contabilidad: '/dashboard/contabilidad',
    pagos: '/dashboard/pagos',
    zonas: '/dashboard/domicilios/zonas',
    domiciliarios: '/dashboard/domicilios/domiciliarios',
    entrega: '/dashboard/entrega',
    configuracion: '/dashboard/configuracion',
    impresoras: '/dashboard/configuracion/impresoras',
    equipo: '/dashboard/equipo',
    // legacy — keep for redirects only
    menu: '/dashboard/menu',
    domicilios: '/dashboard/domicilios',
  },
  // Public menu
  menu: (slug: string) => `/${slug}`,
} as const;
