import type { Restaurant, OpeningHours } from '@/types';

export interface MissingField {
  key: string;
  label: string;
}

function hasActiveDay(openingHours?: OpeningHours): boolean {
  if (!openingHours) return false;
  return Object.values(openingHours).some((v) => v !== null && v !== undefined);
}

export function getMissingRestaurantFields(restaurant: Restaurant): MissingField[] {
  const missing: MissingField[] = [];
  if (!restaurant.logo) missing.push({ key: 'logo', label: 'Logo' });
  if (!restaurant.description || restaurant.description.length < 10)
    missing.push({ key: 'description', label: 'Descripción' });
  if (!restaurant.phone) missing.push({ key: 'phone', label: 'Teléfono / WhatsApp' });
  if (!restaurant.category) missing.push({ key: 'category', label: 'Categoría' });
  if (!restaurant.department) missing.push({ key: 'department', label: 'Departamento' });
  if (!restaurant.city) missing.push({ key: 'city', label: 'Ciudad' });
  if (!hasActiveDay(restaurant.openingHours))
    missing.push({ key: 'hours', label: 'Horario de atención' });
  return missing;
}
