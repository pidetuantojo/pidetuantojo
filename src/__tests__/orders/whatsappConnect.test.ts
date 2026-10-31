// /api/whatsapp/connect: el estado es público (lo usa la carta), pero el QR y desconectar exigen permiso.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { FakeFirestore } from './fakeFirestore';

const db = new FakeFirestore();
const verifyIdToken = vi.fn();
const disconnect = vi.fn();

vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: { verifyIdToken } }));
vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:image/png;base64,QR' } }));
vi.mock('@/lib/whatsapp/session', () => ({
  getWhatsAppSession: () => ({
    getState: () => ({ status: 'qr', qr: 'raw-qr', connectedNumber: null, lastError: null }),
    disconnect,
  }),
}));

let route: typeof import('@/app/api/whatsapp/connect/route');
beforeAll(async () => {
  route = await import('@/app/api/whatsapp/connect/route');
});

function req(method: string, uid?: string) {
  return new NextRequest('http://localhost/api/whatsapp/connect?restaurantId=r1', {
    method, headers: uid ? { Authorization: `Bearer token-${uid}` } : {},
  });
}

describe('/api/whatsapp/connect', () => {
  beforeEach(() => {
    db.docs.clear();
    db.set('users/admin', { role: 'restaurant_admin', isActive: true, restaurantId: 'r1', effectivePermissions: ['settings.view', 'settings.update_info'] });
    db.set('restaurants/r1/settings/waConfig', { autoNotify: true });
    verifyIdToken.mockReset().mockImplementation(async (t: string) => ({ uid: t.replace('token-', '') }));
    disconnect.mockReset();
  });

  it('sin sesión: solo estado, autoNotify y número conectado; nunca el QR', async () => {
    const data = await (await route.GET(req('GET'))).json();
    // Estado 'qr' (no conectado): todavía no hay número que mostrar
    expect(data).toEqual({ status: 'qr', autoNotify: true, connectedNumber: null });
  });

  it('con permiso: incluye el QR', async () => {
    const data = await (await route.GET(req('GET', 'admin'))).json();
    expect(data.qr).toBe('data:image/png;base64,QR');
  });

  it('desconectar sin sesión: 401 y no desconecta', async () => {
    expect((await route.DELETE(req('DELETE'))).status).toBe(401);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('desconectar con permiso: funciona', async () => {
    expect((await route.DELETE(req('DELETE', 'admin'))).status).toBe(200);
    expect(disconnect).toHaveBeenCalled();
  });
});
