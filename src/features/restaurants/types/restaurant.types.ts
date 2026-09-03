export interface DayHoursForm {
  on: boolean;
  open: string;  // "09:00"
  close: string; // "19:00"
}

export interface RestaurantFormData {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  phone: string;
  logo: string;
  bannerImage: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  isActive: boolean;
  // Categoría
  category: string;
  // Ubicación
  address: string;
  department: string;
  city: string;
  mapUrl: string;
  mapEmbed: string;
  // Redes sociales
  instagram: string;
  facebook: string;
  // Formato del menú
  menuLayout: 'cards' | 'list';
  // Modo de domicilios
  deliveryMode: 'manual' | 'zones';
  // Horario de atención — índice 0=domingo, 1=lunes, ..., 6=sábado
  openingHours: DayHoursForm[];
  // Solo en creación
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}
