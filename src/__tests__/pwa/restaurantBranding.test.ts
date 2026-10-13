import { describe, it, expect } from 'vitest';

import { buildPanelManifest } from '@/lib/pwa/panelManifest';
import { DEFAULT_PANEL_ICONS, panelIcons, restaurantIconUrl } from '@/lib/pwa/restaurantIcons';
import { buildNewOrderPush, buildTestPush } from '@/lib/push/payload';

const LOGO = 'https://res.cloudinary.com/dabj5v9gl/image/upload/v1790944175/antojo-app/nksucurrx0ukd3nofcch.png';

describe('restaurantIconUrl', () => {
  it('transforma el logo de Cloudinary en un PNG cuadrado con fondo blanco', () => {
    expect(restaurantIconUrl(LOGO, 512)).toBe(
      'https://res.cloudinary.com/dabj5v9gl/image/upload/c_pad,w_461,h_461,b_white/c_pad,w_512,h_512,b_white,f_png/v1790944175/antojo-app/nksucurrx0ukd3nofcch.png'
    );
  });
  it('maskable deja el logo dentro de la zona segura', () => {
    expect(restaurantIconUrl(LOGO, 512, 'maskable')).toContain('c_pad,w_297,h_297,b_white/c_pad,w_512,h_512');
  });
  it('sin logo o fuera de Cloudinary → null', () => {
    expect(restaurantIconUrl(undefined, 192)).toBeNull();
    expect(restaurantIconUrl('https://otro.com/logo.png', 192)).toBeNull();
  });
});

describe('buildPanelManifest', () => {
  it('con restaurante: su nombre y su logo', () => {
    const m = buildPanelManifest({ name: 'Mangova', logo: LOGO });
    expect(m).toMatchObject({ id: '/dashboard/pedidos', name: 'Mangova · Pedidos', short_name: 'Mangova', start_url: '/dashboard/pedidos?source=pwa' });
    expect(m.icons).toHaveLength(4);
    expect(m.icons.every((i) => i.src.startsWith('https://res.cloudinary.com/'))).toBe(true);
    expect(m.icons.map((i) => i.purpose)).toEqual(['any', 'maskable', 'any', 'maskable']);
  });
  it('nombre largo: debajo del ícono dice "Pedidos"', () => {
    expect(buildPanelManifest({ name: 'La Nonna Pizzería Artesanal' }).short_name).toBe('Pedidos');
  });
  it('sin restaurante o sin logo: los íconos de Pide Tu Antojo, mismo id', () => {
    expect(buildPanelManifest(null)).toMatchObject({ id: '/dashboard/pedidos', name: 'Pide Tu Antojo — Pedidos', icons: DEFAULT_PANEL_ICONS });
    expect(panelIcons(undefined)).toBe(DEFAULT_PANEL_ICONS);
  });
});

describe('logo en la notificación', () => {
  it('se incluye solo si hay logo', () => {
    const icon = restaurantIconUrl(LOGO, 192);
    expect(buildNewOrderPush({ id: 'o1', orderNumber: '#1', customerName: 'Ana', total: 1000 }, icon).icon).toBe(icon);
    expect(buildNewOrderPush({ id: 'o1', orderNumber: '#1', customerName: 'Ana', total: 1000 }, null)).not.toHaveProperty('icon');
    expect(buildTestPush(icon).icon).toBe(icon);
  });
});
