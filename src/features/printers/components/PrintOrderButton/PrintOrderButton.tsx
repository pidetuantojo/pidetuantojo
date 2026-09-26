'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Printer, RotateCcw } from 'lucide-react';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { isQzAvailable } from '@/lib/printer/qzClient';
import { PrintInProgressError, printOrder } from '@/lib/printer/printOrder';
import type { Order } from '@/types';

import { usePrinterConfig } from '../../hooks/usePrinterConfig';

interface PrintOrderButtonProps {
  order: Order;
  restaurantId: string;
}

function formatPrintedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/** Botón "Imprimir" de la comanda: imprime directo en la térmica vía QZ Tray, sin diálogos. */
export function PrintOrderButton({ order, restaurantId }: PrintOrderButtonProps) {
  const { user } = useAuth();
  const { data: printer, isLoading } = usePrinterConfig(restaurantId);
  const { data: restaurant } = useRestaurant(restaurantId);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'restaurant_admin' || user?.role === 'super_admin';
  // Error guardado en el pedido (por ejemplo, desde otro equipo) mientras no haya uno local
  const shownError = error || (order.printStatus === 'error' ? order.printError ?? 'No se pudo imprimir.' : '');
  const printedBefore = !!order.printedAt;

  async function handlePrint() {
    if (!printer || printing) return;
    setPrinting(true);
    setError('');
    try {
      if (!(await isQzAvailable())) {
        throw new Error('QZ Tray no está abierto en este equipo. Ábrelo y vuelve a intentar.');
      }
      await printOrder({ restaurantId, restaurantName: restaurant?.name ?? '', order, printer });
    } catch (err) {
      // Doble click u otro equipo imprimiendo: no es un error para mostrar
      if (!(err instanceof PrintInProgressError)) {
        setError(err instanceof Error ? err.message : 'No se pudo imprimir.');
      }
    } finally {
      setPrinting(false);
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
        disabled={printing}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#374151] py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-70"
      >
        {printing ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Imprimiendo...</>
        ) : shownError ? (
          <><RotateCcw className="h-4 w-4" /> Reintentar impresión</>
        ) : (
          <><Printer className="h-4 w-4" /> {printedBefore ? 'Reimprimir' : 'Imprimir'}</>
        )}
      </button>
      {shownError && !printing ? (
        <p role="alert" className="mt-1 text-center text-[11px] font-medium text-red-500">{shownError}</p>
      ) : printedBefore && order.printedAt && !printing ? (
        <p className="mt-1 text-center text-[10px] text-[var(--t-text-4)]">
          Impreso a las {formatPrintedAt(order.printedAt)}{(order.printCount ?? 0) > 1 ? ` · ${order.printCount} veces` : ''}
        </p>
      ) : null}
    </div>
  );
}
