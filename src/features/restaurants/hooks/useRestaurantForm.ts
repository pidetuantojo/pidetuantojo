import { useState } from 'react';
import { z } from 'zod';

import { slugify } from '@/lib/utils';
import type { Restaurant, UpdateRestaurantData, CreateRestaurantData, OpeningHours } from '@/types';

import type { RestaurantFormData, DayHoursForm } from '../types/restaurant.types';

const baseSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  slug: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  description: z.string().min(10, 'Mínimo 10 caracteres'),
  phone: z.string().min(7, 'Teléfono inválido'),
  logo: z.string().min(1, 'El logo es requerido'),
  category: z.string().min(1, 'La categoría es requerida'),
  department: z.string().min(1, 'El departamento es requerido'),
  city: z.string().min(1, 'La ciudad es requerida'),
});

const createSchema = baseSchema.extend({
  adminName: z.string().min(2, 'Nombre requerido'),
  adminEmail: z.string().email('Email inválido'),
  adminPassword: z.string().min(6, 'Mínimo 6 caracteres'),
});

function defaultOpeningHours(): DayHoursForm[] {
  return Array.from({ length: 7 }, () => ({ on: false, open: '09:00', close: '19:00' }));
}

function firebaseToHoursForm(openingHours?: OpeningHours): DayHoursForm[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = openingHours?.[i];
    return {
      on: !!day,
      open: day?.open ?? '09:00',
      close: day?.close ?? '19:00',
    };
  });
}

function hoursFormToFirebase(hoursForm: DayHoursForm[]): OpeningHours {
  const result: OpeningHours = {};
  hoursForm.forEach((day, index) => {
    result[index] = day.on ? { open: day.open, close: day.close } : null;
  });
  return result;
}

function extractEmbedUrl(value: string): string {
  const match = value.match(/src=["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/);
  return match ? match[1] : value;
}

const defaultValues: RestaurantFormData = {
  name: '',
  slug: '',
  tagline: '',
  description: '',
  phone: '',
  logo: '',
  bannerImage: '',
  primaryColor: '#FF6A1A',
  secondaryColor: '#1B1512',
  accentColor: '#FFE0CC',
  bgColor: '#FBF3EF',
  isActive: true,
  category: '',
  address: '',
  department: '',
  city: '',
  mapUrl: '',
  mapEmbed: '',
  instagram: '',
  facebook: '',
  menuLayout: 'cards',
  deliveryMode: 'manual',
  openingHours: defaultOpeningHours(),
  adminName: '',
  adminEmail: '',
  adminPassword: '',
};

export function useRestaurantForm(restaurant?: Restaurant) {
  const isEditing = !!restaurant;

  const [data, setData] = useState<RestaurantFormData>(() => {
    if (!restaurant) return defaultValues;
    return {
      name: restaurant.name,
      slug: restaurant.slug,
      tagline: restaurant.tagline ?? '',
      description: restaurant.description,
      phone: restaurant.phone,
      logo: restaurant.logo,
      bannerImage: restaurant.bannerImage ?? '',
      primaryColor: restaurant.theme.primaryColor,
      secondaryColor: restaurant.theme.secondaryColor,
      accentColor: restaurant.theme.accentColor,
      bgColor: restaurant.theme.bgColor ?? '#FBF3EF',
      isActive: restaurant.isActive,
      category: restaurant.category ?? '',
      address: restaurant.address ?? '',
      department: restaurant.department ?? '',
      city: restaurant.city ?? '',
      mapUrl: restaurant.mapUrl ?? '',
      mapEmbed: restaurant.mapEmbed ?? '',
      instagram: restaurant.instagram ?? '',
      facebook: restaurant.facebook ?? '',
      menuLayout: restaurant.menuLayout ?? 'cards',
      deliveryMode: restaurant.deliveryMode ?? 'manual',
      openingHours: firebaseToHoursForm(restaurant.openingHours),
      adminName: '',
      adminEmail: '',
      adminPassword: '',
    };
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RestaurantFormData, string>>>({});

  function handleChange<K extends keyof RestaurantFormData>(
    field: K,
    value: RestaurantFormData[K]
  ) {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'name' && !isEditing) {
        next.slug = slugify(value as string);
      }
      // Resetear ciudad cuando cambia el departamento
      if (field === 'department') {
        next.city = '';
      }
      return next;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function setDayHours(dayIndex: number, patch: Partial<DayHoursForm>) {
    setData((prev) => {
      const next = [...prev.openingHours];
      next[dayIndex] = { ...next[dayIndex], ...patch };
      return { ...prev, openingHours: next };
    });
  }

  function validate(): boolean {
    const schema = isEditing ? baseSchema : createSchema;
    const result = schema.safeParse(data);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.errors.forEach((e) => {
        const field = e.path[0] as keyof RestaurantFormData;
        if (!fieldErrors[field]) fieldErrors[field] = e.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  }

  function toCreateData(): Omit<CreateRestaurantData, 'adminUserId'> {
    const hours = hoursFormToFirebase(data.openingHours);
    const hasAnyHours = Object.values(hours).some((v) => v !== null);
    return {
      name: data.name,
      slug: data.slug,
      ...(data.tagline ? { tagline: data.tagline } : {}),
      description: data.description,
      phone: data.phone,
      logo: data.logo,
      ...(data.bannerImage ? { bannerImage: data.bannerImage } : {}),
      theme: {
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        bgColor: data.bgColor,
      },
      isActive: data.isActive,
      ...(data.category ? { category: data.category } : {}),
      ...(data.address ? { address: data.address } : {}),
      ...(data.department ? { department: data.department } : {}),
      ...(data.city ? { city: data.city } : {}),
      ...(data.mapUrl ? { mapUrl: data.mapUrl } : {}),
      ...(data.mapEmbed ? { mapEmbed: extractEmbedUrl(data.mapEmbed) } : {}),
      ...(data.instagram ? { instagram: data.instagram } : {}),
      ...(data.facebook ? { facebook: data.facebook } : {}),
      menuLayout: data.menuLayout,
      deliveryMode: data.deliveryMode,
      ...(hasAnyHours ? { openingHours: hours } : {}),
      adminEmail: data.adminEmail,
      adminPassword: data.adminPassword,
      adminName: data.adminName,
    };
  }

  function toUpdateData(): UpdateRestaurantData {
    const hours = hoursFormToFirebase(data.openingHours);
    const hasAnyHours = Object.values(hours).some((v) => v !== null);
    return {
      name: data.name,
      ...(data.tagline ? { tagline: data.tagline } : {}),
      description: data.description,
      phone: data.phone,
      logo: data.logo,
      ...(data.bannerImage ? { bannerImage: data.bannerImage } : {}),
      theme: {
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        bgColor: data.bgColor,
      },
      isActive: data.isActive,
      ...(data.category ? { category: data.category } : {}),
      ...(data.address ? { address: data.address } : {}),
      ...(data.department ? { department: data.department } : {}),
      ...(data.city ? { city: data.city } : {}),
      ...(data.mapUrl ? { mapUrl: data.mapUrl } : {}),
      ...(data.mapEmbed ? { mapEmbed: extractEmbedUrl(data.mapEmbed) } : {}),
      ...(data.instagram ? { instagram: data.instagram } : {}),
      ...(data.facebook ? { facebook: data.facebook } : {}),
      menuLayout: data.menuLayout,
      deliveryMode: data.deliveryMode,
      ...(hasAnyHours ? { openingHours: hours } : {}),
    };
  }

  return { data, errors, handleChange, setDayHours, validate, toCreateData, toUpdateData, isEditing };
}
