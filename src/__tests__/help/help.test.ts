import { describe, it, expect } from 'vitest';

import type { Permission } from '@/constants/permissions';
import { HELP_GUIDES, HELP_SECTIONS } from '@/features/help/content/registry';
import { GUIDE_CONTENT } from '@/features/help/content/loaders';
import { findGuide, groupBySection, searchGuides, visibleGuides } from '@/features/help/helpers/help.helpers';
import { isPermission } from '@/lib/permissions/permissions';
import type { HelpGuide } from '@/features/help/types/help.types';

const guide = (over: Partial<HelpGuide>): HelpGuide => ({
  section: 'pedidos', slug: 'x', title: 'Título', summary: 'Resumen', minutes: 1, audience: 'Admin', ...over,
});

describe('registro del centro de ayuda', () => {
  it('cada guía apunta a una sección existente', () => {
    const slugs = new Set(HELP_SECTIONS.map((s) => s.slug));
    HELP_GUIDES.forEach((g) => expect(slugs.has(g.section)).toBe(true));
  });

  it('no repite seccion/guia', () => {
    const keys = HELP_GUIDES.map((g) => `${g.section}/${g.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('cada guía tiene su contenido MDX y no sobra ninguno', () => {
    const keys = HELP_GUIDES.map((g) => `${g.section}/${g.slug}`).sort();
    expect(Object.keys(GUIDE_CONTENT).sort()).toEqual(keys);
  });

  it('los permisos de las guías existen en el catálogo', () => {
    HELP_GUIDES.filter((g) => g.permission).forEach((g) => expect(isPermission(g.permission)).toBe(true));
  });
});

describe('visibleGuides', () => {
  const guides = [guide({ slug: 'libre' }), guide({ slug: 'pedidos', permission: 'orders.view' })];

  it('muestra las guías sin permiso a todos', () => {
    expect(visibleGuides(guides, () => false).map((g) => g.slug)).toEqual(['libre']);
  });

  it('muestra las guías con permiso solo si el usuario lo tiene', () => {
    const can = (p: Permission) => p === 'orders.view';
    expect(visibleGuides(guides, can).map((g) => g.slug)).toEqual(['libre', 'pedidos']);
  });
});

describe('searchGuides', () => {
  const guides = [
    guide({ slug: 'a', title: 'Gestiona un pedido', keywords: ['imprimir', 'comanda'] }),
    guide({ slug: 'b', title: 'Zonas de domicilio', summary: 'Tarifas por barrio' }),
  ];

  it('sin búsqueda devuelve todo', () => {
    expect(searchGuides(guides, '  ')).toHaveLength(2);
  });

  it('busca en título, resumen y palabras clave, sin importar tildes ni mayúsculas', () => {
    expect(searchGuides(guides, 'COMANDA').map((g) => g.slug)).toEqual(['a']);
    expect(searchGuides(guides, 'tarifas').map((g) => g.slug)).toEqual(['b']);
    expect(searchGuides([guide({ slug: 'c', title: 'Preparación' })], 'preparacion')).toHaveLength(1);
  });

  it('exige que aparezcan todas las palabras', () => {
    expect(searchGuides(guides, 'pedido barrio')).toHaveLength(0);
  });
});

describe('groupBySection / findGuide', () => {
  it('omite las secciones sin guías y respeta el orden de secciones', () => {
    const groups = groupBySection(HELP_SECTIONS, [guide({ section: 'menu' }), guide({ section: 'pedidos', slug: 'y' })]);
    expect(groups.map((g) => g.section.slug)).toEqual(['pedidos', 'menu']);
  });

  it('encuentra una guía por sección y slug', () => {
    expect(findGuide(HELP_GUIDES, 'pedidos', 'gestionar-un-pedido')?.title).toBeDefined();
    expect(findGuide(HELP_GUIDES, 'pedidos', 'no-existe')).toBeUndefined();
  });
});
