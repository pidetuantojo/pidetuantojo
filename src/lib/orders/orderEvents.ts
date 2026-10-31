// Auditoría de pedidos: qué se hizo, el antes y el después. Puro (sin Firebase): lo usan el panel y el servidor.
// Los eventos viven en orders/{id}/events y las reglas solo permiten crearlos (nunca editar ni borrar).
// Los cambios de estado no van aquí: ya quedan en `statusHistory`.

import type { AssignedDriver, Mesa, Order, OrderDeliveryType, OrderItem, OrderPayment, UpdateOrderData } from '@/types';

export type OrderEventType =
  | 'created' | 'edited' | 'items_removed' | 'delivery_fee' | 'discount' | 'paid_flag'
  | 'payment_added' | 'payment_removed' | 'driver' | 'internal_note' | 'table_moved'
  | 'item_transferred_out' | 'item_transferred_in' | 'table_released' | 'deleted'
  | 'whatsapp_sent' | 'whatsapp_failed';

export interface OrderEventChange {
  label: string;
  before: string;
  after: string;
}

/** Lo que describe un evento (sin quién ni cuándo: eso lo agrega quien lo guarda). */
export interface OrderEventDraft {
  type: OrderEventType;
  summary: string;
  changes?: OrderEventChange[];
  // Acciones que conviene revisar: borrar un pago, descuentos, marcar pendiente, eliminar…
  sensitive?: boolean;
}

export interface OrderEvent extends OrderEventDraft {
  id: string;
  at: string;
  by?: string;
  // Sin byName = lo hizo el sistema (carta, WhatsApp)
  byName?: string;
}

// ─── Formato ──────────────────────────────────────────────────────────────────

export function money(n: number | undefined): string {
  return `$${Math.round(n ?? 0).toLocaleString('es-CO')}`;
}

const DELIVERY_LABEL: Record<OrderDeliveryType, string> = { recoger: 'Para llevar', domicilio: 'Domicilio', mesa: 'Mesa' };

function show(v: string | undefined | null): string {
  return v?.trim() ? v.trim() : '—';
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function paymentText(p: Pick<OrderPayment, 'method' | 'amount' | 'label'>): string {
  return `${p.method} ${money(p.amount)}${p.label ? ` (${p.label})` : ''}`;
}

/** Firestore no acepta undefined: quita las claves sin valor. */
export function compactEvent<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// ─── Productos ────────────────────────────────────────────────────────────────

function itemKey(i: OrderItem): string {
  return [i.productName, ...i.additionals.map((a) => a.name).sort(), i.isGift ? 'regalo' : ''].join('|');
}

function itemLabel(i: OrderItem): string {
  const extras = i.additionals.length ? ` + ${i.additionals.map((a) => a.name).join(', ')}` : '';
  return `${i.productName}${extras}${i.isGift ? ' (regalo)' : ''}`;
}

/** "+1× Papas · −2× Gaseosa". Vacío si los productos no cambiaron. */
export function diffItems(before: OrderItem[], after: OrderItem[]): string {
  const count = (items: OrderItem[]) => {
    const map = new Map<string, { label: string; qty: number }>();
    for (const i of items) {
      const prev = map.get(itemKey(i));
      map.set(itemKey(i), { label: itemLabel(i), qty: (prev?.qty ?? 0) + i.quantity });
    }
    return map;
  };
  const a = count(before);
  const b = count(after);
  const parts: string[] = [];
  for (const [key, { label, qty }] of Array.from(b)) {
    const diff = qty - (a.get(key)?.qty ?? 0);
    if (diff > 0) parts.push(`+${diff}× ${label}`);
  }
  for (const [key, { label, qty }] of Array.from(a)) {
    const diff = qty - (b.get(key)?.qty ?? 0);
    if (diff > 0) parts.push(`−${diff}× ${label}`);
  }
  return parts.join(' · ');
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

export const orderEvents = {
  created(source: 'carta' | 'panel'): OrderEventDraft {
    return { type: 'created', summary: source === 'carta' ? 'Pedido creado desde la carta' : 'Pedido creado en el panel' };
  },

  /** Edición desde "Editar pedido". null si no cambió nada visible. */
  edited(order: Order, data: UpdateOrderData): OrderEventDraft | null {
    const changes: OrderEventChange[] = [];
    const add = (label: string, before: string, after: string) => { if (before !== after) changes.push({ label, before, after }); };

    if ('customerName' in data) add('Cliente', show(order.customerName), show(data.customerName));
    if ('customerPhone' in data) add('Teléfono', show(order.customerPhone), show(data.customerPhone));
    if ('deliveryType' in data) {
      add('Tipo de entrega', DELIVERY_LABEL[order.deliveryType ?? 'recoger'], DELIVERY_LABEL[data.deliveryType ?? 'recoger']);
    }
    if ('customerAddress' in data) add('Dirección', show(order.customerAddress), show(data.customerAddress));
    if ('barrio' in data) add('Barrio', show(order.barrio), show(data.barrio));
    if ('paymentMethod' in data) add('Método de pago', show(order.paymentMethod), show(data.paymentMethod));
    if ('scheduledFor' in data) add('Programado para', fmtDate(order.scheduledFor), fmtDate(data.scheduledFor));
    if (data.items) {
      const diff = diffItems(order.items, data.items);
      if (diff) changes.push({ label: 'Productos', before: '', after: diff });
    }
    if ('total' in data) add('Total', money(order.total), money(data.total));

    if (changes.length === 0) return null;
    // Bajar el total de un pedido ya hecho es lo que más interesa revisar
    const sensitive = data.total !== undefined && data.total < order.total;
    return { type: 'edited', summary: `Editó el pedido (${changes.map((c) => c.label.toLowerCase()).join(', ')})`, changes, sensitive };
  },

  itemsRemoved(order: Order, items: OrderItem[], total: number): OrderEventDraft {
    return {
      type: 'items_removed',
      summary: `Quitó productos: ${diffItems(order.items, items) || '—'}`,
      changes: [{ label: 'Total', before: money(order.total), after: money(total) }],
      sensitive: true,
    };
  },

  deliveryFee(before: number | undefined, after: number, totalBefore: number, totalAfter: number): OrderEventDraft {
    return {
      type: 'delivery_fee',
      summary: `Valor del domicilio: ${money(before)} → ${money(after)}`,
      changes: [
        { label: 'Domicilio', before: money(before), after: money(after) },
        { label: 'Total', before: money(totalBefore), after: money(totalAfter) },
      ],
      sensitive: after < (before ?? 0),
    };
  },

  discount(before: number | undefined, after: number, reason: string | undefined, totalBefore: number, totalAfter: number): OrderEventDraft {
    const summary = after > 0
      ? `Descuento manual de ${money(after)}${reason?.trim() ? ` (${reason.trim()})` : ''}`
      : 'Quitó el descuento manual';
    return {
      type: 'discount',
      summary,
      changes: [
        { label: 'Descuento manual', before: money(before), after: money(after) },
        { label: 'Total', before: money(totalBefore), after: money(totalAfter) },
      ],
      sensitive: after > 0,
    };
  },

  paidFlag(isPaid: boolean): OrderEventDraft {
    return isPaid
      ? { type: 'paid_flag', summary: 'Marcó el pedido como pagado' }
      : { type: 'paid_flag', summary: 'Marcó el pedido como pendiente de pago', sensitive: true };
  },

  paymentsAdded(payments: OrderPayment[]): OrderEventDraft {
    const total = payments.reduce((s, p) => s + p.amount, 0);
    return {
      type: 'payment_added',
      summary: payments.length === 1
        ? `Registró un pago: ${paymentText(payments[0])}`
        : `Registró ${payments.length} pagos por ${money(total)}: ${payments.map(paymentText).join(' · ')}`,
    };
  },

  paymentRemoved(payment: OrderPayment | undefined): OrderEventDraft {
    return { type: 'payment_removed', summary: `Anuló un pago: ${payment ? paymentText(payment) : '—'}`, sensitive: true };
  },

  driver(before: AssignedDriver | undefined, after: AssignedDriver | null): OrderEventDraft {
    const name = (d?: AssignedDriver | null) => (d ? `${d.name}${d.courierName ? ` (${d.courierName})` : ''}` : '—');
    return {
      type: 'driver',
      summary: after ? `Asignó el domiciliario ${name(after)}` : 'Quitó el domiciliario',
      changes: [{ label: 'Domiciliario', before: name(before), after: name(after) }],
    };
  },

  internalNote(before: string | undefined, after: string): OrderEventDraft {
    return {
      type: 'internal_note',
      summary: after ? 'Actualizó la nota interna' : 'Borró la nota interna',
      changes: [{ label: 'Nota interna', before: show(before), after: show(after) }],
    };
  },

  tableMoved(from: string | undefined, to: Pick<Mesa, 'name'>): OrderEventDraft {
    return { type: 'table_moved', summary: `Cambió de mesa: ${show(from)} → ${to.name}`, changes: [{ label: 'Mesa', before: show(from), after: to.name }] };
  },

  itemTransferred(direction: 'out' | 'in', qty: number, item: OrderItem, other: Pick<Order, 'orderNumber' | 'tableName'>): OrderEventDraft {
    const where = other.tableName ? `${other.tableName} (pedido ${other.orderNumber})` : `el pedido ${other.orderNumber}`;
    return direction === 'out'
      ? { type: 'item_transferred_out', summary: `Pasó ${qty}× ${itemLabel(item)} a ${where}` }
      : { type: 'item_transferred_in', summary: `Recibió ${qty}× ${itemLabel(item)} desde ${where}` };
  },

  tableReleased(): OrderEventDraft {
    return { type: 'table_released', summary: 'Liberó la mesa' };
  },

  deleted(reason: string | undefined): OrderEventDraft {
    return { type: 'deleted', summary: `Eliminó el pedido${reason?.trim() ? `: ${reason.trim()}` : ''}`, sensitive: true };
  },

  whatsappSent(what: string): OrderEventDraft {
    return { type: 'whatsapp_sent', summary: `WhatsApp enviado al cliente: ${what}` };
  },

  whatsappFailed(what: string, error: string): OrderEventDraft {
    return { type: 'whatsapp_failed', summary: `No se pudo enviar el WhatsApp (${what}): ${error}` };
  },
};
