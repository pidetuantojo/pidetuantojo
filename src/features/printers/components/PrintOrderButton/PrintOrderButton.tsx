'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Loader2, Printer, RotateCcw } from 'lucide-react';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { isPrintLocked, PrintInProgressError } from '@/lib/printer/printLock';
import { enqueuePrintJob } from '@/lib/printer/printQueue';
import type { Order } from '@/types';

import { usePrinterConfig } from '../../hooks/usePrinterConfig';
import { usePrintStationStatus } from '../../hooks/usePrintStationStatus';

interface PrintOrderButtonProps {
  order: Order;
  restaurantId: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Botón "Imprimir" de la comanda. Funciona desde cualquier dispositivo (tablet, celular, PC):
 * encola el trabajo y la Estación de impresión (PC con QZ Tray) lo imprime. El estado llega en
 * vivo en el pedido: en cola → imprimiendo → impreso / error.
 */
export function PrintOrderButton({ order, restaurantId }: PrintOrderButtonProps) {
  const { user } = useAuth();
  const { data: printer, isLoading } = usePrinterConfig(restaurantId);
  const { online: stationOnline, loaded: stationLoaded } = usePrintStationStatus(restaurantId);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // El candado de "en cola" vence con el tiempo: recalcular para habilitar "Reintentar"
  useEffect(() => {
    if (order.printStatus !== 'queued' && order.printStatus !== 'printing') return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [order.printStatus]);

  const isAdmin = user?.role === 'restaurant_admin' || user?.role === 'super_admin';
  const locked = isPrintLocked(order, now);
  const queued = order.printStatus === 'queued' && locked;
  const printing = order.printStatus === 'printing' && locked;
  // Si el candado venció sin imprimir, se ofrece reintentar
  const stuck = (order.printStatus === 'queued' || order.printStatus === 'printing') && !locked;
  const shownError = error
    || (order.printStatus === 'error' ? order.printError ?? 'No se pudo imprimir.' : '')
    || (stuck ? 'La impresión no se completó.' : '');
  const busy = sending || queued || printing;

  async function handlePrint() {
    if (!printer || busy || !user) return;
    setSending(true);
    setError('');
    try {
      await enqueuePrintJob({
        restaurantId,
        order,
        requestedBy: user.uid,
        requestedByName: user.displayName ?? user.email,
      });
    } catch (err) {
      // Doble click u otro equipo ya lo mandó: no es un error para mostrar
      if (!(err instanceof PrintInProgressError)) {
        setError(err instanceof Error ? err.message : 'No se pudo enviar a imprimir.');
      }
    } finally {
      setSending(false);
    }
  }

  if (isLoading) return null;

  if (!printer) {
    return (
      <div className="mt-2 rounded-xl border border-dashed border-[var(--t-border)] px-3 py-2 text-center text-xs text-[var(--t-text-4)]" onClick={(e) => e.stopPropagation()}>
        {isAdmin ? (
          <Link href={ROUTES.dashboard.impresoras} className="font-semibold text-[#FF6A1A] hover:underline">
            Configurar impresora para imprimir comandas
          </Link>
        ) : (
          'Pide al administrador que configure la impresora'
        )}
      </div>
    );
  }

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={handlePrint}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#374151] py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-70"
      >
        {sending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
        ) : printing ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Imprimiendo...</>
        ) : queued ? (
          <><Clock className="h-4 w-4" /> En cola de impresión...</>
        ) : shownError ? (
          <><RotateCcw className="h-4 w-4" /> Reintentar impresión</>
        ) : (
          <><Printer className="h-4 w-4" /> {order.printedAt ? 'Reimprimir' : 'Imprimir'}</>
        )}
      </button>

      {shownError && !busy ? (
        <p role="alert" className="mt-1 text-center text-[11px] font-medium text-red-500">{shownError}</p>
      ) : order.printedAt && !busy ? (
        <p className="mt-1 text-center text-[10px] text-[var(--t-text-4)]">
          Impreso a las {formatTime(order.printedAt)}{(order.printCount ?? 0) > 1 ? ` · ${order.printCount} veces` : ''}
        </p>
      ) : null}

      {/* Sin estación escuchando, lo encolado no sale: avisar en vez de dejarlo esperando en silencio */}
      {stationLoaded && !stationOnline && (queued || !busy) && (
        <p className="mt-1 text-center text-[10px] font-medium text-amber-600">
          La estación de impresión no está activa: abre{' '}
          {isAdmin ? (
            <Link href={ROUTES.dashboard.estacionImpresion} className="underline">Estación de impresión</Link>
          ) : (
            'Estación de impresión'
          )}{' '}
          en el PC de la impresora.
        </p>
      )}
    </div>
  );
}
