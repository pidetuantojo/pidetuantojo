export const ROUTES = {
  home: '/',
  login: '/login',
  registrarLocal: '/registrar-local',
  // Super admin
  admin: {
    root: '/admin',
    restaurants: '/admin/restaurantes',
    leads: '/admin/inscripciones',
    plans: '/admin/planes',
    planNew: '/admin/planes/nuevo',
    plan: (id: string) => `/admin/planes/${id}`,
    categorias: '/admin/categorias',
    categoriaNueva: '/admin/categorias/nueva',
    categoria: (id: string) => `/admin/categorias/${id}`,
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
    promociones: '/dashboard/promociones',
    pagos: '/dashboard/pagos',
    zonas: '/dashboard/domicilios/zonas',
    domiciliarios: '/dashboard/domicilios/domiciliarios',
    entrega: '/dashboard/entrega',
    configuracion: '/dashboard/configuracion',
    impresoras: '/dashboard/configuracion/impresoras',
    estacionImpresion: '/dashboard/estacion-impresion',
    equipo: '/dashboard/equipo',
    whatsapp: '/dashboard/whatsapp',
    notificaciones: {
      root: '/dashboard/notificaciones',
      plantillas: '/dashboard/notificaciones/plantillas',
      whatsapp: '/dashboard/notificaciones/whatsapp',
    },
    // legacy — keep for redirects only
    menu: '/dashboard/menu',
    domicilios: '/dashboard/domicilios',
  },
  // Public menu
  menu: (slug: string) => `/${slug}`,
} as const;
