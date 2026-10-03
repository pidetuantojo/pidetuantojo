import type { Restaurant } from '@/types';

export interface RestaurantColorsPayload {
  pri: string;
  sec: string;
  acc: string;
  bg: string;
  name: string;
  layout: 'cards' | 'list';
  logo: string;
  bannerImage: string;
}

export interface RestaurantFormProps {
  restaurant?: Restaurant;
  onSuccess: () => void;
  onCancel: () => void;
  onColorsChange?: (colors: RestaurantColorsPayload) => void;
  // Solo en las páginas del super admin: elegir el plan del restaurante (obligatorio al crear)
  showPlanSelector?: boolean;
  // Formulario mínimo de creación: solo Plan, Nombre, Slug y Usuario administrador
  variant?: 'create-minimal';
}
