import type { Metadata, Viewport } from 'next';

// PWA del panel ("Pedidos"). El manifest se enlaza SOLO desde el panel y el login:
// el menú público /[slug] no lo usa, así un cliente que agrega el menú a su inicio no termina en el login.
export const PANEL_MANIFEST_URL = '/panel.webmanifest';
export const PANEL_THEME_COLOR = '#FF6A1A';

export const panelMetadata: Metadata = {
  manifest: PANEL_MANIFEST_URL,
  // iPhone: Safari → Compartir → "Agregar a inicio" abre en pantalla completa
  appleWebApp: {
    capable: true,
    title: 'Pedidos',
    statusBarStyle: 'default',
  },
};

export const panelViewport: Viewport = {
  themeColor: PANEL_THEME_COLOR,
};
