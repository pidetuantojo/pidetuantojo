import type { MDXContent } from 'mdx/types';

// Contenido MDX de cada guía, por "seccion/guia". Cada entrada de registry.ts necesita su archivo aquí.
export const GUIDE_CONTENT: Record<string, () => Promise<{ default: MDXContent }>> = {
  'primeros-pasos/recorrido-del-panel': () => import('./primeros-pasos/recorrido-del-panel.mdx'),
  'pedidos/gestionar-un-pedido': () => import('./pedidos/gestionar-un-pedido.mdx'),
};
