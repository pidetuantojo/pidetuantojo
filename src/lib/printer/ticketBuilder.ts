import { formatScheduledDate } from '@/features/menu/helpers/schedule.helpers';
import { getOrderTotals } from '@/features/orders/helpers/totals.helpers';
import type { Order, OrderItem, PrinterConfig } from '@/types';

import { EscPos } from './escpos';

const DELIVERY_TITLES: Record<NonNullable<Order['deliveryType']>, string> = {
  domicilio: 'DOMICILIO',
  recoger: 'RECOGER EN TIENDA',
  mesa: 'COMER EN EL LOCAL',
};

type TicketPrinter = Pick<PrinterConfig, 'paperWidth' | 'encoding'>;

interface TicketOptions {
  restaurantName: string;
  // Por defecto, todos los items del pedido (preparado para separar por estación más adelante)
  items?: OrderItem[];
  // Título opcional de estación (ej: "COCINA")
  station?: string;
  // Para tests: fecha/hora fija
  now?: Date;
}

/** Montos sin espacio y sin decimales: "$15.000". */
export function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-CO')}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Comanda de un pedido en ESC/POS.
 * Montos: productos = subtotal; total = subtotal + valor de domicilio.
 */
export function buildOrderTicket(order: Order, printer: TicketPrinter, options: TicketOptions): string {
  const items = options.items ?? order.items;
  const p = new EscPos(printer.paperWidth, printer.encoding);
  const halfWidth = Math.floor(p.width / 2);
  const isDomicilio = order.deliveryType === 'domicilio';

  p.init();

  // ── Encabezado
  p.align('center').bold().line(options.restaurantName).bold(false);
  if (options.station) p.line(options.station.toUpperCase());
  p.doubleSize().line(`PEDIDO ${order.orderNumber}`, halfWidth).doubleSize(false);
  p.bold().line(order.deliveryType ? DELIVERY_TITLES[order.deliveryType] : 'PEDIDO').bold(false);
  if (order.deliveryType === 'mesa' && order.tableName) {
    p.doubleSize().line(order.tableName, halfWidth).doubleSize(false);
  }
  p.line(formatTime(order.createdAt));
  // Programado: lo más importante para cocina, bien visible
  if (order.isScheduled && order.scheduledFor) {
    p.bold().line(`PROGRAMADO: ${formatScheduledDate(new Date(order.scheduledFor))}`).bold(false);
  }
  if (options.now) p.line(`Impreso: ${formatTime(options.now.toISOString())}`);

  // ── Cliente
  p.align('left').divider();
  p.line(`Cliente: ${order.customerName}`);
  p.line(`Cel: ${order.customerPhone}`);
  if (isDomicilio) {
    if (order.customerAddress) p.line(`Dir: ${order.customerAddress}`);
    if (order.barrio) p.line(`Barrio: ${order.barrio}`);
  }

  // ── Items
  p.divider();
  items.forEach((item) => {
    p.bold().lineLR(`${item.quantity} x ${item.productName}`, formatMoney(item.subtotal)).bold(false);
    item.additionals.forEach((a) => p.line(`  + ${a.name}`));
    if (item.specialInstructions?.trim()) p.line(`  * ${item.specialInstructions.trim()}`);
  });

  // ── Notas
  if (order.notes?.trim()) {
    p.divider().bold().line('NOTA DEL PEDIDO:').bold(false).line(order.notes.trim());
  }
  if (order.internalNote?.trim()) {
    p.divider().bold().line('NOTA INTERNA:').bold(false).line(order.internalNote.trim());
  }

  // ── Totales (solo si es el ticket completo, no el de una estación)
  if (!options.station) {
    // Misma convención que la tarjeta del pedido: total = productos + valor de domicilio
    const { productsTotal, deliveryFee, total } = getOrderTotals(order);
    p.divider();
    if (deliveryFee > 0) {
      p.lineLR('Productos', formatMoney(productsTotal));
      p.lineLR('Valor domicilio', formatMoney(deliveryFee));
    }
    p.bold().lineLR('TOTAL', formatMoney(total)).bold(false);
    p.line(`Pago: ${order.paymentMethod}${order.paymentAccount ? ` ${order.paymentAccount}` : ''}${order.isPaid ? ' (PAGADO)' : ''}`);
    if (isDomicilio && !order.deliveryFee) p.line('Valor de domicilio pendiente');
  }

  p.feed(3).cut();
  return p.build();
}

/** Ticket corto para "Probar impresión" desde la configuración. */
export function buildTestTicket(printer: TicketPrinter & { name: string }, restaurantName: string, now = new Date()): string {
  const p = new EscPos(printer.paperWidth, printer.encoding);
  p.init()
    .align('center').bold().line(restaurantName).bold(false)
    .doubleSize().line('PRUEBA', Math.floor(p.width / 2)).doubleSize(false)
    .line(formatTime(now.toISOString()))
    .align('left').divider()
    .line(`Impresora: ${printer.name}`)
    .line(`Papel: ${printer.paperWidth} mm (${p.width} caracteres)`)
    .line(`Tildes: áéíóú ñ ¿? ¡!`)
    .lineLR('1 x Producto de prueba', formatMoney(15000))
    .divider()
    .align('center').line('Si ves este ticket completo,').line('la impresora quedó configurada.')
    .feed(3).cut();
  return p.build();
}
