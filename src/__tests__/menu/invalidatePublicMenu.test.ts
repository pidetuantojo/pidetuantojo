// Las mutaciones del panel que cambian la carta avisan al servidor para vaciar su caché.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/authFetch', () => ({ authFetch: vi.fn() }));

import { publicMenuMeta, publicMenuRestaurant } from '@/lib/menu/invalidatePublicMenu';

describe('publicMenuMeta / publicMenuRestaurant', () => {
  it('con el id fijo del restaurante (productos, categorías, promociones…)', () => {
    expect(publicMenuRestaurant(publicMenuMeta('r1'), { anything: true })).toBe('r1');
  });

  it('con el id sacado de las variables (editar o activar un restaurante)', () => {
    const meta = publicMenuMeta(({ id }: { id: string }) => id);
    expect(publicMenuRestaurant(meta, { id: 'r2', data: {} })).toBe('r2');
  });

  it('las mutaciones sin meta no avisan', () => {
    expect(publicMenuRestaurant(undefined, {})).toBeUndefined();
    expect(publicMenuRestaurant({ other: 1 }, {})).toBeUndefined();
  });
});
