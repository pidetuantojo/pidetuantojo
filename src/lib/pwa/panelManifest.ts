// Manifest de la PWA "Pedidos". Con restaurante: su nombre y su logo en el acceso directo.
import { panelIcons } from './restaurantIcons';

export interface PanelManifestRestaurant {
  name: string;
  logo?: string;
}

const MAX_SHORT_NAME = 15;

export function buildPanelManifest(restaurant?: PanelManifestRestaurant | null) {
  const name = restaurant?.name.trim();
  return {
    // Mismo id con o sin restaurante: las apps ya instaladas se actualizan en vez de duplicarse
    id: '/dashboard/pedidos',
    name: name ? `${name} · Pedidos` : 'Pide Tu Antojo — Pedidos',
    // Texto debajo del ícono: el nombre del restaurante si cabe
    short_name: name && name.length <= MAX_SHORT_NAME ? name : 'Pedidos',
    description: 'Panel de pedidos del restaurante: recibe y gestiona los pedidos en vivo.',
    lang: 'es-CO',
    start_url: '/dashboard/pedidos?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#FBF8F5',
    theme_color: '#FF6A1A',
    categories: ['business', 'food'],
    icons: panelIcons(restaurant?.logo),
    shortcuts: [
      { name: 'Pedidos en vivo', short_name: 'Pedidos', url: '/dashboard/pedidos', icons: [{ src: '/android-chrome-192.png', sizes: '192x192' }] },
      { name: 'Estación de impresión', short_name: 'Impresión', url: '/dashboard/estacion-impresion', icons: [{ src: '/android-chrome-192.png', sizes: '192x192' }] },
    ],
  };
}
