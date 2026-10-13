// Índice del centro de ayuda. Solo metadatos (sin MDX) para poder usarlo en tests y en el buscador.
// Plan: docs/plan-centro-de-ayuda.md
import type { HelpGuide, HelpSection } from '../types/help.types';

export const HELP_SECTIONS: readonly HelpSection[] = [
  { slug: 'primeros-pasos', title: 'Primeros pasos', description: 'Conoce el panel y deja tu restaurante listo para recibir pedidos.' },
  { slug: 'pedidos', title: 'Pedidos', description: 'Recibe, prepara, cobra y entrega pedidos del día a día.' },
  { slug: 'menu', title: 'Menú', description: 'Categorías, productos, adicionales y promociones.' },
  { slug: 'domicilios', title: 'Domicilios', description: 'Zonas, tarifas, domiciliarios y métodos de entrega.' },
  { slug: 'cobros', title: 'Cobros', description: 'Métodos de pago y contabilidad.' },
  { slug: 'configuracion', title: 'Configuración', description: 'Datos del restaurante, impresoras, WhatsApp y equipo.' },
  { slug: 'problemas-frecuentes', title: 'Problemas frecuentes', description: 'Soluciones rápidas cuando algo no funciona.' },
];

export const HELP_GUIDES: readonly HelpGuide[] = [
  {
    section: 'primeros-pasos',
    slug: 'recorrido-del-panel',
    title: 'Recorrido por el panel',
    summary: 'Qué hay en cada sección del menú lateral y para qué sirve.',
    minutes: 2,
    audience: 'Admin y empleados',
    keywords: ['inicio', 'menu lateral', 'sidebar', 'navegar'],
  },
  {
    section: 'pedidos',
    slug: 'gestionar-un-pedido',
    title: 'Gestiona un pedido de principio a fin',
    summary: 'Desde que suena la alerta hasta que el pedido llega al cliente.',
    minutes: 3,
    permission: 'orders.view',
    audience: 'Admin y empleados',
    keywords: ['estado', 'imprimir', 'comanda', 'whatsapp', 'domiciliario', 'pagar', 'entregado', 'cancelar'],
  },
];
