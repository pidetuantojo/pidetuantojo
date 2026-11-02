// @vitest-environment node
// Caché de la carta: quién puede vaciarla, qué se vacía, y lo que se calcula fuera de la caché.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestore } from '../orders/fakeFirestore';

const db = new FakeFirestore();
const verifyIdToken = vi.fn();
const revalidateTag = vi.fn();

vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: { verifyIdToken } }));
vi.mock('next/cache', () => ({ revalidateTag }));

let POST: typeof import('@/app/api/menu/revalidate/route').POST;
let selectActivePromotions: typeof import('@/lib/promotions/promotions.server').selectActivePromotions;
let isSuspendedWith: typeof import('@/lib/restaurants/restaurant.server').isSuspendedWith;
beforeAll(async () => {
  ({ POST } = await import('@/app/api/menu/revalidate/route'));
  ({ selectActivePromotions } = await import('@/lib/promotions/promotions.server'));
  ({ isSuspendedWith } = await import('@/lib/restaurants/restaurant.server'));
});

function call(uid: string | undefined, restaurantId: string) {
  return POST(new Request('http://localhost/api/menu/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer token-${uid}` } : {}) },
    body: JSON.stringify({ restaurantId }),
  }));
}

describe('POST /api/menu/revalidate', () => {
  beforeEach(() => {
    db.docs.clear();
    db.set('users/cajero', { role: 'restaurant_employee', isActive: true, restaurantId: 'r1', effectivePermissions: ['orders.view'] });
    db.set('users/otro', { role: 'restaurant_admin', isActive: true, restaurantId: 'r2', effectivePermissions: [] });
    db.set('users/root', { role: 'super_admin', isActive: true });
    db.set('restaurants/r1', { slug: 'mangova', name: 'Mangova' });
    verifyIdToken.mockReset().mockImplementation(async (t: string) => ({ uid: t.replace('token-', '') }));
    revalidateTag.mockReset();
  });

  it('sin sesión 401; de otro restaurante 403 (no puede vaciar cartas ajenas)', async () => {
    expect((await call(undefined, 'r1')).status).toBe(401);
    expect((await call('otro', 'r1')).status).toBe(403);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('alguien del restaurante vacía su catálogo y los datos del restaurante (por slug)', async () => {
    expect((await call('cajero', 'r1')).status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('menu:r1');
    expect(revalidateTag).toHaveBeenCalledWith('menu-slug:mangova');
    expect(revalidateTag).not.toHaveBeenCalledWith('menu');
  });

  it('restaurante borrado: el super admin vacía todas las cartas (no se sabe el slug)', async () => {
    expect((await call('root', 'borrado')).status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('menu');
  });
});

describe('lo que depende de la hora se calcula fuera de la caché', () => {
  const restaurant = { id: 'r1', planFeatures: ['features.promotions', 'features.promotions_advanced'] } as never;

  it('selectActivePromotions descarta vencidas y agotadas con la fecha de la visita', () => {
    const promos = [
      { id: 'vigente', schedule: { endDate: '2026-11-30' } },
      { id: 'vencida', schedule: { endDate: '2026-11-01' } },
      { id: 'agotada', maxUses: 10, usesCount: 10 },
    ] as never[];
    const ids = selectActivePromotions(restaurant, promos, new Date('2026-11-02T15:00:00-05:00')).map((p) => p.id);
    expect(ids).toEqual(['vigente']);
    // Sin la función en el plan, ninguna
    expect(selectActivePromotions({ id: 'r1', planFeatures: [] } as never, promos)).toEqual([]);
  });

  it('isSuspendedWith: sin plan nunca; con vencimiento pasado la gracia, sí', () => {
    expect(isSuspendedWith({ id: 'r1' } as never)).toBe(false);
    expect(isSuspendedWith({ id: 'r1', planId: 'p1', subscriptionEndDate: '2026-01-01' } as never, 'monthly')).toBe(true);
    expect(isSuspendedWith({ id: 'r1', planId: 'p1', subscriptionEndDate: '2999-01-01' } as never, 'monthly')).toBe(false);
  });
});
