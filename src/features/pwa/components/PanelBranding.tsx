'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { PANEL_MANIFEST_URL } from '@/lib/pwa/panelMetadata';
import { restaurantIconUrl } from '@/lib/pwa/restaurantIcons';
import type { Restaurant } from '@/types';

function upsertHeadTag(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  apply(el);
}

/**
 * Personaliza la app instalada con el restaurante del usuario: el manifest pasa a
 * `/panel.webmanifest?r={id}` (nombre + logo) y en iPhone el ícono y el nombre de "Agregar a inicio".
 * iPhone toma el ícono SOLO al instalar; Android lo actualiza solo con el tiempo.
 */
export function PanelBranding({ restaurant }: { restaurant?: Pick<Restaurant, 'id' | 'name' | 'logo'> | null }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!restaurant?.id) return;

    upsertHeadTag('link[rel="manifest"]', () => Object.assign(document.createElement('link'), { rel: 'manifest' }), (el) => {
      (el as HTMLLinkElement).href = `${PANEL_MANIFEST_URL}?r=${encodeURIComponent(restaurant.id)}`;
    });

    const appleIcon = restaurantIconUrl(restaurant.logo, 180);
    if (appleIcon) {
      upsertHeadTag('link[rel="apple-touch-icon"]', () => Object.assign(document.createElement('link'), { rel: 'apple-touch-icon' }), (el) => {
        (el as HTMLLinkElement).href = appleIcon;
        el.setAttribute('sizes', '180x180');
      });
    }

    if (restaurant.name) {
      upsertHeadTag('meta[name="apple-mobile-web-app-title"]', () => Object.assign(document.createElement('meta'), { name: 'apple-mobile-web-app-title' }), (el) => {
        (el as HTMLMetaElement).content = restaurant.name;
      });
    }
    // Se reaplica al navegar: Next puede volver a pintar las etiquetas del <head>
  }, [restaurant?.id, restaurant?.name, restaurant?.logo, pathname]);

  return null;
}
