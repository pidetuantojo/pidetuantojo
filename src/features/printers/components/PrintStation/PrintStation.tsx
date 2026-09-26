'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { CheckCircle2, Loader2, Printer, XCircle } from 'lucide-react';

import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import {
  claimPrintJob, completePrintJob, failPrintJob, MAIN_STATION_ID, printJobsRef, sendStationHeartbeat,
} from '@/lib/printer/printQueue';
import { describePrintError, isQzAvailable, printRaw } from '@/lib/printer/qzClient';
import { buildOrderTicket } from '@/lib/printer/ticketBuilder';
import type { PrintJob, PrintJobStatus } from '@/types';

import { usePrinterConfig } from '../../hooks/usePrinterConfig';

const sg = 'var(--font-sans, sans-serif)';
const sm = 'var(--font-mono, monospace)';
const HEARTBEAT_MS = 30_000;
const QZ_CHECK_MS = 15_000;
// Reintenta la cola aunque no haya cambios (trabajos tomados por una estación que se cayó)
const SWEEP_MS = 20_000;

const STATUS_LABEL: Record<PrintJobStatus, { text: string; color: string }> = {
  pending: { text: 'En cola', color: '#d97706' },
  printing: { text: 'Imprimiendo', color: '#2563eb' },
  done: { text: 'Impreso', color: '#059669' },
  failed: { text: 'Error', color: '#dc2626' },
  superseded: { text: 'Reemplazado', color: 'var(--t-text-4)' },
};

const card: React.CSSProperties = {
  background: 'var(--t-surface)', border: '1.5px solid var(--t-border-2)', borderRadius: 18, padding: '16px 18px',
};

function formatTime(iso?: string) {
  return iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
}

/**
 * Estación de impresión: se deja abierta en el PC que tiene la impresora y QZ Tray.
 * Escucha la cola (restaurants/{id}/printJobs) e imprime lo que mandan tablets, celulares u otros PCs.
 */
export function PrintStation() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';
  const { data: printer, isLoading: printerLoading } = usePrinterConfig(restaurantId || undefined);
  const { data: restaurant } = useRestaurant(restaurantId || undefined);

  const [qzConnected, setQzConnected] = useState<boolean | null>(null);
  const [pending, setPending] = useState<PrintJob[]>([]);
  const [recent, setRecent] = useState<PrintJob[]>([]);
  const [printedCount, setPrintedCount] = useState(0);
  const [lastError, setLastError] = useState('');
  // URL de esta página para el acceso directo en modo kiosko (se lee en el cliente)
  const [pageUrl, setPageUrl] = useState('https://www.pidetuantojo.com/dashboard/estacion-impresion');
  useEffect(() => { setPageUrl(`${window.location.origin}${window.location.pathname}`); }, []);

  // Refs: el procesador corre fuera del ciclo de render y necesita los valores actuales
  const session = useRef(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const processing = useRef(false);
  const pendingRef = useRef<PrintJob[]>([]);
  const ctx = useRef({ printer, restaurantName: restaurant?.name ?? '', qzConnected });
  ctx.current = { printer, restaurantName: restaurant?.name ?? '', qzConnected };

  // ── QZ Tray: comprobar conexión periódicamente
  useEffect(() => {
    let active = true;
    const check = async () => { const ok = await isQzAvailable(); if (active) setQzConnected(ok); };
    check();
    const t = setInterval(check, QZ_CHECK_MS);
    return () => { active = false; clearInterval(t); };
  }, []);

  // ── Procesar la cola de a un trabajo por vez
  const processQueue = useCallback(async () => {
    if (processing.current || !restaurantId) return;
    const { printer: p, qzConnected: qz } = ctx.current;
    if (!p || !qz) return; // sin impresora o sin QZ: los trabajos quedan en cola
    processing.current = true;
    try {
      for (const job of [...pendingRef.current]) {
        let claim;
        try {
          claim = await claimPrintJob(restaurantId, job.id, session.current);
        } catch {
          continue; // conflicto de transacción u otra estación: se reintenta en el próximo barrido
        }
        if (!claim.claimed) continue;
        try {
          const ticket = buildOrderTicket(claim.order, p, { restaurantName: ctx.current.restaurantName, now: new Date() });
          await printRaw(p.name, ticket, p.encoding);
          await completePrintJob(restaurantId, job);
          setPrintedCount((n) => n + 1);
          setLastError('');
        } catch (err) {
          const message = describePrintError(err);
          setLastError(`Pedido ${job.orderNumber}: ${message}`);
          await failPrintJob(restaurantId, job, message).catch(() => {});
        }
      }
    } finally {
      processing.current = false;
    }
  }, [restaurantId]);

  // ── Cola en tiempo real (pendientes y en impresión, de esta estación)
  useEffect(() => {
    if (!restaurantId) return;
    const q = query(printJobsRef(restaurantId), where('status', 'in', ['pending', 'printing']));
    return onSnapshot(q, (snap) => {
      const jobs = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }) as PrintJob)
        .filter((j) => (j.station ?? MAIN_STATION_ID) === MAIN_STATION_ID)
        .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
      pendingRef.current = jobs;
      setPending(jobs);
      processQueue();
    });
  }, [restaurantId, processQueue]);

  // Al conectar QZ o configurar la impresora, procesar lo acumulado; y barrido periódico
  useEffect(() => { processQueue(); }, [qzConnected, printer, processQueue]);
  useEffect(() => {
    const t = setInterval(processQueue, SWEEP_MS);
    return () => clearInterval(t);
  }, [processQueue]);

  // ── Historial reciente
  useEffect(() => {
    if (!restaurantId) return;
    const q = query(printJobsRef(restaurantId), orderBy('requestedAt', 'desc'), limit(12));
    return onSnapshot(q, (snap) => setRecent(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as PrintJob)));
  }, [restaurantId]);

  // ── Latido: las tablets lo usan para saber si hay una estación escuchando
  useEffect(() => {
    if (!restaurantId) return;
    const beat = () => sendStationHeartbeat(restaurantId, {
      qzConnected: !!ctx.current.qzConnected,
      printerName: ctx.current.printer?.name,
      userEmail: user?.email,
    }).catch(() => {});
    beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [restaurantId, user?.email, qzConnected]);

  // ── Mantener la pantalla encendida (evita que el equipo suspenda la pestaña)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const acquire = () => nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    acquire();
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); lock?.release().catch(() => {}); };
  }, []);

  if (!restaurantId) return null;

  const ready = !!printer && qzConnected === true;
  const status = printerLoading || qzConnected === null
    ? { icon: <Loader2 size={22} className="animate-spin" color="var(--t-text-3)" />, title: 'Iniciando...', detail: '' }
    : !printer
      ? { icon: <XCircle size={22} color="#dc2626" />, title: 'No hay impresora configurada', detail: 'Configúrala en Mi restaurante → Impresoras.' }
      : !qzConnected
        ? { icon: <XCircle size={22} color="#dc2626" />, title: 'QZ Tray no está abierto en este equipo', detail: 'Ábrelo desde el menú Inicio. Los pedidos quedan en cola y se imprimen al conectar.' }
        : { icon: <CheckCircle2 size={22} color="#059669" />, title: 'Escuchando pedidos para imprimir', detail: `Impresora: ${printer.name} · Deja esta pestaña abierta.` };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: sg, maxWidth: 820 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>Estación de impresión</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--t-text-3)' }}>
          Imprime las comandas que se envían desde tablets, celulares u otros computadores. Mantén esta página abierta en el PC conectado a la impresora.
        </p>
      </div>

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, borderColor: ready ? '#05966955' : 'var(--t-border-2)' }}>
        {status.icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t-text-1)' }}>{status.title}</div>
          {status.detail && <div style={{ fontSize: 13, color: 'var(--t-text-3)', marginTop: 2 }}>{status.detail}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: sm, fontSize: 22, fontWeight: 700, color: 'var(--t-text-1)' }}>{pending.length}</div>
          <div style={{ fontSize: 11, color: 'var(--t-text-3)' }}>en cola</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: sm, fontSize: 22, fontWeight: 700, color: '#059669' }}>{printedCount}</div>
          <div style={{ fontSize: 11, color: 'var(--t-text-3)' }}>impresos</div>
        </div>
      </div>

      {lastError && (
        <div role="alert" style={{ ...card, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
          {lastError}
        </div>
      )}

      <div style={card}>
        <div style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--t-text-3)', textTransform: 'uppercase', marginBottom: 10 }}>
          Últimos trabajos
        </div>
        {recent.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-3)' }}>Todavía no se ha enviado nada a imprimir.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map((job) => {
              const s = STATUS_LABEL[job.status];
              return (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 10px', borderRadius: 10, background: 'var(--t-surface-2)' }}>
                  <Printer size={14} color="var(--t-text-3)" />
                  <span style={{ fontFamily: sm, fontWeight: 700, color: 'var(--t-text-1)' }}>{job.orderNumber}</span>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--t-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatTime(job.requestedAt)}{job.requestedByName ? ` · ${job.requestedByName}` : ''}{job.error ? ` · ${job.error}` : ''}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 12, color: s.color, flexShrink: 0 }}>{s.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ ...card, fontSize: 13, color: 'var(--t-text-2)', lineHeight: 1.6 }}>
        <strong>Para que quede siempre activa:</strong> abre esta página en modo kiosko con un acceso directo en la carpeta de inicio de Windows
        (<code style={{ fontFamily: sm, fontSize: 12 }}>shell:startup</code>):
        <pre style={{ margin: '8px 0 0', padding: '8px 10px', borderRadius: 8, background: 'var(--t-surface-2)', fontFamily: sm, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {`"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk ${pageUrl}`}
        </pre>
      </div>
    </div>
  );
}
