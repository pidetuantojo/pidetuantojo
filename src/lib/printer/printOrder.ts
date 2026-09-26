'use client';

import { deleteField, doc, increment, runTransaction, updateDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { Order, PrinterConfig } from '@/types';

import { isPrintLocked, PrintInProgressError } from './printLock';
import { describePrintError, printRaw } from './qzClient';
import { buildOrderTicket } from './ticketBuilder';

export { PrintInProgressError } from './printLock';

interface PrintOrderParams {
  restaurantId: string;
  restaurantName: string;
  order: Order;
  printer: Pick<PrinterConfig, 'name' | 'paperWidth' | 'encoding'>;
}

/**
 * Imprime la comanda de un pedido.
 * 1. Transacción: marca el pedido como "imprimiendo" (evita doble impresión por doble click o dos equipos).
 * 2. Envía el ticket a QZ Tray.
 * 3. Marca "impreso" (printedAt, printCount) o guarda el error en el pedido para reintentar.
 *
 * Por ahora todo va a una sola impresora: los productos no tienen estación (cocina/bar/caja).
 */
export async function printOrder({ restaurantId, restaurantName, order, printer }: PrintOrderParams): Promise<void> {
  const orderRef = doc(db, 'restaurants', restaurantId, 'orders', order.id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new Error('El pedido ya no existe.');
    if (isPrintLocked(snap.data() as Order)) throw new PrintInProgressError();
    tx.update(orderRef, {
      printStatus: 'printing',
      printingStartedAt: new Date().toISOString(),
      printError: deleteField(),
    });
  });

  try {
    const ticket = buildOrderTicket(order, printer, { restaurantName, now: new Date() });
    await printRaw(printer.name, ticket, printer.encoding);
    await updateDoc(orderRef, {
      printStatus: 'printed',
      printedAt: new Date().toISOString(),
      printCount: increment(1),
      printingStartedAt: deleteField(),
    });
  } catch (error) {
    const message = describePrintError(error);
    await updateDoc(orderRef, {
      printStatus: 'error',
      printError: message,
      printingStartedAt: deleteField(),
    }).catch(() => { /* si tampoco se puede guardar el error, igual lo mostramos en pantalla */ });
    throw new Error(message);
  }
}
