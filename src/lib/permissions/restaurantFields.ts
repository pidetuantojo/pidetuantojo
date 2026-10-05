import type { Permission } from '@/constants/permissions';
import type { Restaurant } from '@/types';

type RestaurantField = keyof Restaurant;

/**
 * Qué campos del restaurante puede cambiar cada permiso de Configuración.
 * Debe coincidir con `restaurantUpdateAllowed` en firestore.rules: lo que no está acá
 * (slug, isActive, plan*, adminUserId…) solo lo cambia el super admin.
 */
export const RESTAURANT_FIELD_GROUPS = {
  'settings.update_info': ['name', 'tagline', 'description', 'phone', 'categoryIds'],
  'settings.update_branding': ['logo', 'bannerImage', 'theme', 'menuLayout'],
  'settings.update_location': ['address', 'department', 'city', 'mapUrl', 'mapEmbed'],
  'settings.update_social': ['instagram', 'facebook', 'tiktok', 'twitter'],
  'settings.update_hours': ['openingHours', 'allowScheduledWhenClosed'],
  'settings.update_delivery_mode': ['deliveryMode'],
  'payment_methods.manage': ['paymentMethods'],
  'delivery_methods.manage': ['deliveryMethods'],
  'promotions.manage': ['loyalty'],
} as const satisfies Partial<Record<Permission, readonly RestaurantField[]>>;

/**
 * Deja en `data` solo los campos que el usuario puede cambiar según sus permisos.
 * Así un guardado de Configuración no manda campos de secciones bloqueadas (que Firestore rechazaría
 * si cambiaron, por ejemplo un valor normalizado distinto al guardado).
 */
export function pickEditableRestaurantFields<T extends Partial<Record<RestaurantField, unknown>>>(
  data: T,
  can: (permission: Permission) => boolean
): Partial<T> {
  const allowed = new Set<string>();
  for (const [permission, fields] of Object.entries(RESTAURANT_FIELD_GROUPS)) {
    if (can(permission as Permission)) fields.forEach((f) => allowed.add(f));
  }
  return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.has(key))) as Partial<T>;
}
