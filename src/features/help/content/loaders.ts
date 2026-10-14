import type { MDXContent } from 'mdx/types';

// Contenido MDX de cada guía, por "seccion/guia". Cada entrada de registry.ts necesita su archivo aquí.
export const GUIDE_CONTENT: Record<string, () => Promise<{ default: MDXContent }>> = {
  // Primeros pasos
  'primeros-pasos/checklist-inicial': () => import('./primeros-pasos/checklist-inicial.mdx'),
  'primeros-pasos/recorrido-del-panel': () => import('./primeros-pasos/recorrido-del-panel.mdx'),
  // Pedidos
  'pedidos/gestionar-un-pedido': () => import('./pedidos/gestionar-un-pedido.mdx'),
  // Menú
  'menu/agregar-categorias': () => import('./menu/agregar-categorias.mdx'),
  'menu/agregar-productos': () => import('./menu/agregar-productos.mdx'),
  'menu/ver-menu-como-cliente': () => import('./menu/ver-menu-como-cliente.mdx'),
  // Domicilios
  'domicilios/zonas-y-tarifas': () => import('./domicilios/zonas-y-tarifas.mdx'),
  'domicilios/domiciliarios': () => import('./domicilios/domiciliarios.mdx'),
  // Cobros
  'cobros/metodos-de-pago': () => import('./cobros/metodos-de-pago.mdx'),
  'cobros/contabilidad': () => import('./cobros/contabilidad.mdx'),
  // Configuración
  'configuracion/datos-del-restaurante': () => import('./configuracion/datos-del-restaurante.mdx'),
  'configuracion/impresoras': () => import('./configuracion/impresoras.mdx'),
  'configuracion/whatsapp': () => import('./configuracion/whatsapp.mdx'),
  'configuracion/equipo-y-permisos': () => import('./configuracion/equipo-y-permisos.mdx'),
  // Problemas frecuentes
  'problemas-frecuentes/no-imprime': () => import('./problemas-frecuentes/no-imprime.mdx'),
  'problemas-frecuentes/whatsapp-desconectado': () => import('./problemas-frecuentes/whatsapp-desconectado.mdx'),
  'problemas-frecuentes/no-llegan-pedidos': () => import('./problemas-frecuentes/no-llegan-pedidos.mdx'),
};
