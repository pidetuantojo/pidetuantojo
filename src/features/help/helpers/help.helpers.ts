import type { Permission } from '@/constants/permissions';

import type { HelpGuide, HelpSection } from '../types/help.types';

/** Guías que el usuario puede ver según sus permisos. */
export function visibleGuides(guides: readonly HelpGuide[], can: (p: Permission) => boolean): HelpGuide[] {
  return guides.filter((g) => !g.permission || can(g.permission));
}

// Minúsculas y sin tildes: "preparación" encuentra "preparacion"
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Busca por título, resumen y palabras clave. Todas las palabras de la búsqueda deben aparecer. */
export function searchGuides(guides: readonly HelpGuide[], query: string): HelpGuide[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [...guides];
  return guides.filter((g) => {
    const haystack = normalize([g.title, g.summary, ...(g.keywords ?? [])].join(' '));
    return terms.every((t) => haystack.includes(t));
  });
}

/** Secciones con sus guías, sin las que quedan vacías. */
export function groupBySection(sections: readonly HelpSection[], guides: readonly HelpGuide[]) {
  return sections
    .map((section) => ({ section, guides: guides.filter((g) => g.section === section.slug) }))
    .filter((group) => group.guides.length > 0);
}

export function findGuide(guides: readonly HelpGuide[], section: string, slug: string): HelpGuide | undefined {
  return guides.find((g) => g.section === section && g.slug === slug);
}
