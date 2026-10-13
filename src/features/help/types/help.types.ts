import type { Permission } from '@/constants/permissions';

export interface HelpSection {
  slug: string;
  title: string;
  description: string;
}

export interface HelpGuide {
  section: string;
  slug: string;
  title: string;
  // Una línea: para qué sirve
  summary: string;
  minutes: number;
  // Permiso que necesita el usuario para ver la guía (sin permiso = todos)
  permission?: Permission;
  // A quién va dirigida, se muestra como etiqueta
  audience: 'Admin' | 'Admin y empleados';
  // Palabras extra para el buscador
  keywords?: readonly string[];
}
