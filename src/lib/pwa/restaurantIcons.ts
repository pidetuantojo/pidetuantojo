// Íconos de la app instalada y de las notificaciones con el logo del restaurante.
// El logo vive en Cloudinary: se transforma al vuelo a un PNG cuadrado con fondo blanco
// (iPhone pinta de negro lo transparente y Android recorta los íconos "maskable").

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

export type IconKind = 'any' | 'maskable';

/**
 * URL del logo como ícono cuadrado de `size` px, o null si el logo no está en Cloudinary.
 * - any: el logo ocupa ~90% del cuadrado
 * - maskable: el logo queda dentro del círculo seguro (Android recorta hasta el 80% central)
 */
export function restaurantIconUrl(logo: string | undefined | null, size: number, kind: IconKind = 'any'): string | null {
  const match = logo?.match(CLOUDINARY_UPLOAD);
  if (!match) return null;
  const inner = Math.round(size * (kind === 'maskable' ? 0.58 : 0.9));
  const transform = `c_pad,w_${inner},h_${inner},b_white/c_pad,w_${size},h_${size},b_white,f_png`;
  return `${match[1]}${transform}/${match[2]}`;
}

export interface PanelIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: IconKind;
}

export const DEFAULT_PANEL_ICONS: PanelIcon[] = [
  { src: '/android-chrome-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/android-chrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

/** Íconos del manifest: los del restaurante si tiene logo en Cloudinary; si no, los de Pide Tu Antojo. */
export function panelIcons(logo: string | undefined | null): PanelIcon[] {
  if (!restaurantIconUrl(logo, 192)) return DEFAULT_PANEL_ICONS;
  return ([192, 512] as const).flatMap((size) => (['any', 'maskable'] as const).map((purpose) => ({
    src: restaurantIconUrl(logo, size, purpose)!,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose,
  })));
}
