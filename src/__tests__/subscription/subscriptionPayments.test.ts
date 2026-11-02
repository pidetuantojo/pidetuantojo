// @vitest-environment node
// Pagos de suscripción: solo el super admin; el pago y el vencimiento se mueven juntos; anular revierte.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteField, FakeFirestore } from '../orders/fakeFirestore';

const db = new FakeFirestore();
const verifyIdToken = vi.fn();
const uploadPrivateFile = vi.fn();
const deletePrivateFile = vi.fn();

vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: { verifyIdToken } }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: deleteField } }));
vi.mock('@/lib/cloudinary/cloudinary.server', () => ({
  uploadPrivateFile,
  deletePrivateFile,
  privateFileUrl: (id: string) => `https://signed/${id}`,
  cloudinary: { uploader: { upload: vi.fn() } },
}));

type Routes = {
  register: typeof import('@/app/api/admin/subscription-payments/route').POST;
  voidPayment: typeof import('@/app/api/admin/subscription-payments/[id]/void/route').POST;
  receipt: typeof import('@/app/api/admin/subscription-payments/[id]/receipt/route').GET;
  upload: typeof import('@/app/api/cloudinary/upload/route').POST;
};
const routes = {} as Routes;
beforeAll(async () => {
  routes.register = (await import('@/app/api/admin/subscription-payments/route')).POST;
  routes.voidPayment = (await import('@/app/api/admin/subscription-payments/[id]/void/route')).POST;
  routes.receipt = (await import('@/app/api/admin/subscription-payments/[id]/receipt/route')).GET;
  routes.upload = (await import('@/app/api/cloudinary/upload/route')).POST;
});

const auth = (uid?: string): Record<string, string> => (uid ? { Authorization: `Bearer token-${uid}` } : {});

function register(uid: string | undefined, fields: Record<string, string>, receipt?: File) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  if (receipt) form.append('receipt', receipt);
  return routes.register(new Request('http://localhost/api/admin/subscription-payments', { method: 'POST', headers: auth(uid), body: form }));
}

function voidPayment(uid: string | undefined, id: string, reason = 'Pago duplicado') {
  return routes.voidPayment(
    new Request(`http://localhost/api/admin/subscription-payments/${id}/void`, { method: 'POST', headers: { ...auth(uid), 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }),
    { params: { id } },
  );
}

const fields = { restaurantId: 'r1', amount: '80000', paidAt: '2026-10-20', method: 'nequi', periods: '1', reference: 'M123' };

describe('pagos de suscripción', () => {
  beforeEach(() => {
    db.docs.clear();
    db.set('users/root', { role: 'super_admin', isActive: true, displayName: 'Ricardo' });
    db.set('users/dueno', { role: 'restaurant_admin', isActive: true, restaurantId: 'r1', effectivePermissions: ['settings.update_info'] });
    db.set('plans/p1', { name: 'Pro', billingPeriod: 'monthly', price: 80000 });
    db.set('restaurants/r1', { name: 'Mangova', planId: 'p1', subscriptionEndDate: '2026-10-15' });
    verifyIdToken.mockReset().mockImplementation(async (t: string) => ({ uid: t.replace('token-', '') }));
    uploadPrivateFile.mockReset().mockResolvedValue({ publicId: 'antojo-app/subscription-receipts/abc', format: 'jpg' });
    deletePrivateFile.mockReset().mockResolvedValue(undefined);
  });

  it('sin sesión 401; un restaurante no puede registrar pagos 403', async () => {
    expect((await register(undefined, fields)).status).toBe(401);
    expect((await register('dueno', fields)).status).toBe(403);
    expect(db.get('restaurants/r1')?.subscriptionEndDate).toBe('2026-10-15');
  });

  it('registra el pago con comprobante y extiende desde el vencimiento (pagó en la gracia)', async () => {
    const res = await register('root', fields, new File(['x'], 'comprobante.jpg', { type: 'image/jpeg' }));
    expect(res.status).toBe(201);
    const payment = await res.json();
    expect(payment).toMatchObject({
      restaurantName: 'Mangova', planName: 'Pro', amount: 80000, method: 'nequi', reference: 'M123',
      periodStart: '2026-10-15', periodEnd: '2026-11-15', previousEndDate: '2026-10-15', previousPaymentId: null,
      receipt: { publicId: 'antojo-app/subscription-receipts/abc', format: 'jpg' }, status: 'registered',
      createdBy: { uid: 'root', name: 'Ricardo' },
    });
    expect(db.get(`subscriptionPayments/${payment.id}`)).toBeDefined();
    expect(db.get('restaurants/r1')).toMatchObject({ subscriptionEndDate: '2026-11-15', subscriptionAnchorDay: 15, lastSubscriptionPaymentId: payment.id });
  });

  it('valida los datos y el comprobante sin tocar nada', async () => {
    expect((await register('root', { ...fields, paidAt: '2999-01-01' })).status).toBe(400);
    expect((await register('root', { ...fields, periods: '0' })).status).toBe(400);
    expect((await register('root', fields, new File(['x'], 'virus.exe', { type: 'application/x-msdownload' }))).status).toBe(400);
    expect(uploadPrivateFile).not.toHaveBeenCalled();
    expect(db.get('restaurants/r1')?.lastSubscriptionPaymentId).toBeUndefined();
  });

  it('si el pago falla, borra el comprobante subido', async () => {
    db.set('restaurants/r1', { name: 'Mangova' }); // sin plan → 409
    const res = await register('root', fields, new File(['x'], 'c.png', { type: 'image/png' }));
    expect(res.status).toBe(409);
    expect(deletePrivateFile).toHaveBeenCalledWith('antojo-app/subscription-receipts/abc');
  });

  it('anular: solo el último pago, y el vencimiento vuelve al anterior', async () => {
    const first = await (await register('root', fields)).json();
    const second = await (await register('root', { ...fields, paidAt: '2026-10-21' })).json();
    expect(db.get('restaurants/r1')?.subscriptionEndDate).toBe('2026-12-15');

    expect((await voidPayment('dueno', second.id)).status).toBe(403);
    expect((await voidPayment('root', first.id)).status).toBe(409);
    expect((await voidPayment('root', second.id, '')).status).toBe(400);

    expect((await voidPayment('root', second.id)).status).toBe(200);
    expect(db.get(`subscriptionPayments/${second.id}`)).toMatchObject({ status: 'voided', voidReason: 'Pago duplicado', voidedBy: { uid: 'root', name: 'Ricardo' } });
    expect(db.get('restaurants/r1')).toMatchObject({ subscriptionEndDate: '2026-11-15', lastSubscriptionPaymentId: first.id });
    expect((await voidPayment('root', second.id)).status).toBe(409);

    // Anular el primero deja el restaurante como estaba antes de cualquier pago
    expect((await voidPayment('root', first.id)).status).toBe(200);
    const r1 = db.get('restaurants/r1')!;
    expect(r1.subscriptionEndDate).toBe('2026-10-15');
    expect(r1).not.toHaveProperty('lastSubscriptionPaymentId');
    expect(r1).not.toHaveProperty('subscriptionAnchorDay');
  });

  it('el comprobante solo se ve con enlace firmado y solo el super admin', async () => {
    const payment = await (await register('root', fields, new File(['x'], 'c.jpg', { type: 'image/jpeg' }))).json();
    const get = (uid?: string) => routes.receipt(new Request('http://localhost', { headers: auth(uid) }), { params: { id: payment.id } });
    expect((await get('dueno')).status).toBe(403);
    const res = await get('root');
    expect(await res.json()).toEqual({ url: 'https://signed/antojo-app/subscription-receipts/abc' });
  });
});

describe('POST /api/cloudinary/upload', () => {
  it('exige sesión (antes estaba abierto a cualquiera)', async () => {
    const form = new FormData();
    form.append('file', new File(['x'], 'a.png', { type: 'image/png' }));
    const res = await routes.upload(new Request('http://localhost/api/cloudinary/upload', { method: 'POST', body: form }) as never);
    expect(res.status).toBe(401);
  });
});
