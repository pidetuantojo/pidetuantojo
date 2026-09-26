'use client';

import {
  collection, deleteField, doc, increment, runTransaction, setDoc, updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import type { Order, PrintJob, PrintStation } from '@/types';

import { isPrintLocked, PrintInProgressError, resolveJobAction } from './printLock';

export const MAIN_STATION_ID = 'main';

const orderRef = (restaurantId: string, orderId: string) => doc(db, 'restaurants', restaurantId, 'orders', orderId);
export const printJobsRef = (restaurantId: string) => collection(db, 'restaurants', restaurantId, 'printJobs');
const jobRef = (restaurantId: string, jobId: string) => doc(printJobsRef(restaurantId), jobId);
export const stationRef = (restaurantId: string, stationId = MAIN_STATION_ID) =>
  doc(db, 'restaurants', restaurantId, 'printStations', stationId);

interface EnqueueParams {
  restaurantId: string;
  order: Pick<Order, 'id' | 'orderNumber'>;
  requestedBy: string;
  requestedByName?: string;
  station?: string;
}

/**
 * Encola la impresión de un pedido (desde cualquier dispositivo: tablet, celular, PC).
 * Transacción: si ya está en cola o imprimiéndose, no se duplica. El pedido guarda el id del
 * último trabajo; la estación descarta los anteriores.
 */
export async function enqueuePrintJob({
  restaurantId, order, requestedBy, requestedByName, station = MAIN_STATION_ID,
}: EnqueueParams): Promise<string> {
  const newJob = doc(printJobsRef(restaurantId));
  const now = new Date().toISOString();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef(restaurantId, order.id));
    if (!snap.exists()) throw new Error('El pedido ya no existe.');
    if (isPrintLocked(snap.data() as Order)) throw new PrintInProgressError();

    const job: PrintJob = {
      id: newJob.id,
      restaurantId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      station,
      status: 'pending',
      requestedBy,
      ...(requestedByName ? { requestedByName } : {}),
      requestedAt: now,
    };
    tx.set(newJob, job);
    tx.update(orderRef(restaurantId, order.id), {
      printStatus: 'queued',
      printJobId: newJob.id,
      printQueuedAt: now,
      printError: deleteField(),
    });
  });

  return newJob.id;
}

export type ClaimResult = { claimed: true; order: Order } | { claimed: false };

/**
 * La estación intenta tomar un trabajo. Transacción: si dos pestañas/PCs escuchan la cola,
 * solo una lo imprime. Los trabajos viejos (hay uno más nuevo) o huérfanos se cierran sin imprimir.
 */
export async function claimPrintJob(restaurantId: string, jobId: string, stationSession: string): Promise<ClaimResult> {
  return runTransaction(db, async (tx) => {
    const jobSnap = await tx.get(jobRef(restaurantId, jobId));
    if (!jobSnap.exists()) return { claimed: false } as const;
    const job = jobSnap.data() as PrintJob;

    const orderSnap = await tx.get(orderRef(restaurantId, job.orderId));
    const order = orderSnap.exists() ? ({ ...orderSnap.data(), id: orderSnap.id } as Order) : null;
    const now = new Date().toISOString();

    switch (resolveJobAction(job, order)) {
      case 'orphan':
        tx.update(jobSnap.ref, { status: 'failed', error: 'El pedido ya no existe', completedAt: now });
        return { claimed: false } as const;
      case 'supersede':
        tx.update(jobSnap.ref, { status: 'superseded', completedAt: now });
        return { claimed: false } as const;
      case 'skip':
        return { claimed: false } as const;
      case 'claim':
        tx.update(jobSnap.ref, { status: 'printing', claimedBy: stationSession, claimedAt: now });
        tx.update(orderSnap.ref, { printStatus: 'printing', printingStartedAt: now });
        return { claimed: true, order: order! } as const;
    }
  });
}

export async function completePrintJob(restaurantId: string, job: Pick<PrintJob, 'id' | 'orderId'>): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(jobRef(restaurantId, job.id), { status: 'done', completedAt: now, error: deleteField() });
  await updateDoc(orderRef(restaurantId, job.orderId), {
    printStatus: 'printed',
    printedAt: now,
    printCount: increment(1),
    printingStartedAt: deleteField(),
    printError: deleteField(),
  });
}

export async function failPrintJob(restaurantId: string, job: Pick<PrintJob, 'id' | 'orderId'>, message: string): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(jobRef(restaurantId, job.id), { status: 'failed', error: message, completedAt: now });
  await updateDoc(orderRef(restaurantId, job.orderId), {
    printStatus: 'error',
    printError: message,
    printingStartedAt: deleteField(),
  }).catch(() => { /* el pedido pudo borrarse; el trabajo ya quedó marcado */ });
}

/** Latido de la estación: la tablet lo usa para avisar si nadie está escuchando la cola. */
export async function sendStationHeartbeat(
  restaurantId: string,
  data: Pick<PrintStation, 'qzConnected' | 'printerName' | 'userEmail'>,
  stationId = MAIN_STATION_ID
): Promise<void> {
  const payload: PrintStation = {
    id: stationId,
    restaurantId,
    lastSeenAt: new Date().toISOString(),
    qzConnected: data.qzConnected,
    ...(data.printerName ? { printerName: data.printerName } : {}),
    ...(data.userEmail ? { userEmail: data.userEmail } : {}),
  };
  await setDoc(stationRef(restaurantId, stationId), payload);
}
