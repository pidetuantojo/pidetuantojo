// /api/whatsapp/notify: el navegador solo dice qué pedido y qué evento. Teléfono y texto salen
// de Firestore, y hace falta sesión con permiso sobre ese restaurante.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

import { arrayUnion, FakeFirestore, increment, serverTimestamp } from './fakeFirestore';

const db = new FakeFirestore();
const verifyIdToken = vi.fn();
const sendWhatsApp = vi.fn();

vi.mock('@/lib/firebase/admin', () => ({ adminDb: db, adminAuth: { verifyIdToken } }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { increment, arrayUnion, serverTimestamp } }));
vi.mock('@/lib/whatsapp/session', () => ({ getWhatsAppSession: () => ({}) }));
vi.mock('@/lib/whatsapp/send.server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/whatsapp/send.server')>()),
  sendWhatsApp,
}));

let POST: typeof import('@/app/api/whatsapp/notify/route').POST;
beforeAll(async () => {
  ({ POST } = await import('@/app/api/whatsapp/notify/route'));
});

const R = 'restaurants/r1';
const ORDER = `${R}/orders/o1`;

function seed() {
  db.docs.clear();
  db.set('users/cajero', { role: 'restaurant_employee', isActive: true, restaurantId: 'r1', effectivePermissions: ['orders.view', 'orders.change_status', 'orders.mark_paid'] });
  db.set('users/cocina', { role: 'restaurant_employee', isActive: true, restaurantId: 'r1', effectivePermissions: ['orders.view'] });
  db.set('users/otro', { role: 'restaurant_admin', isActive: true, restaurantId: 'r2', effectivePermissions: ['orders.view', 'orders.change_status'] });
  db.set(`${R}/settings/waConfig`, { autoNotify: true });
  db.set(`${R}/settings/waTemplates`, { custom: { c1: { name: 'Empacado', body: 'Hola {{nombreCliente}}, pedido {{numeroPedido}}: {{estadoPedido}}', createdAt: '' } } });
  db.set(`${R}/orderStatuses/st-pack`, { code: 'empacado', name: 'Empacado', waTemplateId: 'c1' });
  db.set(`${R}/orderStatuses/st-prep`, { code: 'preparing', name: 'Preparando', notifyCustomer: false });
  db.set(ORDER, {
    orderNumber: '1042', customerName: 'Ana', customerPhone: '300 123 4567', deliveryType: 'domicilio',
    paymentMethod: 'Nequi', items: [], subtotal: 20000, total: 20000, statusId: 'st-pack', isPaid: false,
  });
}

function call(body: Record<string, unknown>, uid: string | null = 'cajero') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (uid) headers.Authorization = `Bearer token-${uid}`;
  return POST(new Request('http://localhost/api/whatsapp/notify', { method: 'POST', headers, body: JSON.stringify(body) }));
}
const statusBody = { restaurantId: 'r1', orderId: 'o1', event: 'status' };

describe('POST /api/whatsapp/notify', () => {
  beforeEach(() => {
    seed();
    verifyIdToken.mockReset().mockImplementation(async (t: string) => ({ uid: t.replace('token-', '') }));
    sendWhatsApp.mockReset().mockResolvedValue({ ok: true });
  });

  it('rechaza el contrato viejo (teléfono y texto libres)', async () => {
    const res = await call({ restaurantId: 'r1', phone: '3000000000', message: 'Paga aquí: link-falso' });
    expect(res.status).toBe(400);
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it('sin sesión: 401', async () => {
    expect((await call(statusBody, null)).status).toBe(401);
  });

  it('sin permiso o de otro restaurante: 403', async () => {
    expect((await call(statusBody, 'cocina')).status).toBe(403);
    expect((await call(statusBody, 'otro')).status).toBe(403);
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it('pedido inexistente: 404', async () => {
    expect((await call({ ...statusBody, orderId: 'nope' })).status).toBe(404);
  });

  it('arma el mensaje con la plantilla del estado y el teléfono del pedido guardado', async () => {
    const res = await call(statusBody);
    expect(res.status).toBe(200);
    expect(sendWhatsApp).toHaveBeenCalledWith('r1', '3001234567', 'Hola Ana, pedido 1042: Empacado');
  });

  it('deja en la auditoría el WhatsApp enviado o fallido', async () => {
    await call(statusBody);
    sendWhatsApp.mockResolvedValue({ ok: false, status: 503, error: 'WhatsApp no está conectado' });
    await call({ restaurantId: 'r1', orderId: 'o1', event: 'paid' }); // no pagado: se omite, sin evento
    db.update(ORDER, { isPaid: true });
    await call({ restaurantId: 'r1', orderId: 'o1', event: 'paid' });
    const summaries = Array.from(db.docs.entries())
      .filter(([p]) => p.startsWith(`${ORDER}/events/`))
      .map(([, d]) => d.summary);
    expect(summaries).toEqual([
      'WhatsApp enviado al cliente: estado Empacado',
      'No se pudo enviar el WhatsApp (pedido pagado): WhatsApp no está conectado',
    ]);
  });

  it('no repite el aviso del mismo estado', async () => {
    await call(statusBody);
    const res = await call(statusBody);
    expect(await res.json()).toMatchObject({ skipped: 'already_sent' });
    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
  });

  it('no envía si el estado no avisa, si no avisa en mesa o si los mensajes automáticos están apagados', async () => {
    db.update(ORDER, { statusId: 'st-prep' });
    expect(await (await call(statusBody)).json()).toMatchObject({ skipped: 'status_silent' });

    // st-pack no configuró mesa: por defecto no avisa
    db.update(ORDER, { statusId: 'st-pack', deliveryType: 'mesa' });
    expect(await (await call(statusBody)).json()).toMatchObject({ skipped: 'status_silent' });

    db.update(ORDER, { deliveryType: 'domicilio' });
    db.set(`${R}/settings/waConfig`, { autoNotify: false });
    expect(await (await call(statusBody)).json()).toMatchObject({ skipped: 'auto_notify_off' });

    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it('avisa en el método de entrega que el estado tenga encendido', async () => {
    db.set(`${R}/orderStatuses/st-ready`, { code: 'ready', name: 'Listo', notifyByDelivery: { recoger: true, domicilio: false, mesa: true } });
    db.update(ORDER, { statusId: 'st-ready' });
    expect(await (await call(statusBody)).json()).toMatchObject({ skipped: 'status_silent' }); // domicilio

    db.update(ORDER, { deliveryType: 'mesa' });
    expect((await call(statusBody)).status).toBe(200);
    expect(sendWhatsApp).toHaveBeenCalledWith('r1', '3001234567', expect.stringContaining('Listo'));
  });

  it('"pagado" solo si el pedido realmente está pagado', async () => {
    const paid = { restaurantId: 'r1', orderId: 'o1', event: 'paid' };
    expect(await (await call(paid)).json()).toMatchObject({ skipped: 'not_paid' });
    db.update(ORDER, { isPaid: true });
    await call(paid);
    expect(sendWhatsApp).toHaveBeenCalledWith('r1', '3001234567', expect.stringContaining('1042'));
  });

  it('si WhatsApp falla, responde el error y no marca el aviso como enviado', async () => {
    sendWhatsApp.mockResolvedValue({ ok: false, status: 503, error: 'WhatsApp no está conectado' });
    const res = await call(statusBody);
    expect(res.status).toBe(503);
    expect(db.get(ORDER)?.waNotified).toBeUndefined();
  });
});
