'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingBag,
  Wifi,
  RefreshCw,
  Plus,
  X,
  Volume2,
  VolumeX,
  CalendarDays,
  Bike,
  LayoutGrid,
  Eye,
  EyeOff,
} from 'lucide-react';
import { DateRangePicker } from '@/components/ui/DateRangePicker/DateRangePicker';

import { useAuth } from '@/features/auth';
import { useOrderStatuses } from '@/features/order-statuses/hooks/useOrderStatuses';
import { useProducts } from '@/features/products/hooks/useProducts';
import { useAdicionales } from '@/features/adicionales/hooks/useAdicionales';
import { useCategories } from '@/features/categories';
import { useDomiciliarios } from '@/features/delivery-zones/hooks/useDomiciliarios';
import { useMesas } from '@/features/delivery-methods/hooks/useMesas';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import type { Order } from '@/types';

import { useOrders } from '../../hooks/useOrders';
import { useVoiceNotifications } from '../../hooks/useVoiceNotifications';
import { PwaControls } from '@/features/pwa/components/PwaControls';
import { ordersService } from '../../services/orders.service';
import { useToastStore } from '@/store/toast.store';
import { getBoardColumn, getOccupiedTables, isOrderFinished, type BoardColumnKey } from '../../helpers/board.helpers';
import { OrderCard } from '../OrderCard';
import { OrderDrawer } from '../OrderDrawer';
import { ManualOrderModal } from '../ManualOrderModal';
import { EditOrderModal } from '../EditOrderModal';
import { DeleteOrderModal } from '../DeleteOrderModal/DeleteOrderModal';

import type { DateRange } from '../../hooks/useOrders';

type PresetKey = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom';

interface ActiveRange extends DateRange {
  preset: PresetKey;
}

// ── Toast ────────────────────────────────────────────────────────────────────

interface ToastItem {
  id: number;
  orderNumber: string;
}

function NewOrderToast({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 10);
    const t2 = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onClose(toast.id), 400);
    }, 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [toast.id, onClose]);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(() => onClose(toast.id), 400);
  };

  return (
    <div
      className="duration-400 pointer-events-auto w-full max-w-sm transition-all"
      style={{
        opacity: visible && !leaving ? 1 : 0,
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(110%)',
        transitionDuration: '400ms',
      }}
    >
      <div
        className="overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
      >
        <div className="h-1 overflow-hidden bg-white/20">
          <div
            className="h-full bg-white/60"
            style={{ animation: 'toast-progress 5.5s linear forwards' }}
          />
        </div>
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 text-xl">
            🔔
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">¡Nuevo pedido!</p>
            <p className="mt-0.5 text-xs text-white/80">{toast.orderNumber}</p>
          </div>
          <button
            onClick={handleClose}
            className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </div>
      <style>{`@keyframes toast-progress { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  );
}

function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastItem[];
  onClose: (id: number) => void;
}) {
  if (toasts.length === 0 || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2"
      style={{ maxWidth: 360, width: 'calc(100vw - 2rem)' }}
    >
      {toasts.map((t) => (
        <NewOrderToast key={t.id} toast={t} onClose={onClose} />
      ))}
    </div>,
    document.body
  );
}

// ── Notification sound ────────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_audioCtx) _audioCtx = new AudioContext();
  return _audioCtx;
}

function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const doPlay = () => {
      const notes = [880, 1108];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(doPlay);
    } else {
      doPlay();
    }
  } catch {
    // AudioContext no disponible
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDayISO(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayISO(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function getPresetRange(preset: Exclude<PresetKey, 'custom'>): DateRange {
  const now = new Date();
  if (preset === 'today') return { start: startOfDayISO(now), end: endOfDayISO(now) };
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { start: startOfDayISO(y), end: endOfDayISO(y) };
  }
  if (preset === 'last7') {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { start: startOfDayISO(s), end: endOfDayISO(now) };
  }
  // thisMonth
  const m = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: startOfDayISO(m), end: endOfDayISO(now) };
}


function formatRangeLabel(range: ActiveRange): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  if (range.preset === 'today') return 'Hoy';
  if (range.preset === 'yesterday') return 'Ayer';
  if (range.preset === 'last7') return 'Últ. 7 días';
  if (range.preset === 'thisMonth') return 'Este mes';
  return `${fmt(range.start)} – ${fmt(range.end)}`;
}

// ── Columnas del tablero ──────────────────────────────────────────────────────

const COLUMNS: { key: BoardColumnKey; label: string; empty: string; color: string; icon: typeof ShoppingBag }[] = [
  { key: 'recoger', label: 'Para llevar', empty: 'No hay pedidos para llevar activos', color: '#2563eb', icon: ShoppingBag },
  { key: 'domicilio', label: 'Domicilio', empty: 'No hay domicilios activos', color: '#7c3aed', icon: Bike },
  { key: 'mesa', label: 'Mesa', empty: 'No hay mesas abiertas', color: '#16a34a', icon: LayoutGrid },
];

// ── Main component ────────────────────────────────────────────────────────────

export function OrdersManager() {
  const { user, can } = useAuth();
  const restaurantId = user?.restaurantId ?? '';
  const dineInEnabled = can('features.dine_in');

  const [refreshKey, setRefreshKey] = useState(0);
  const [activeRange, setActiveRange] = useState<ActiveRange>(() => ({
    preset: 'today',
    ...getPresetRange('today'),
  }));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { orders, isLoading } = useOrders(restaurantId, activeRange, refreshKey);
  const { data: statuses = [] } = useOrderStatuses(restaurantId);
  const { data: products = [] } = useProducts(restaurantId);
  const { data: adicionales = [] } = useAdicionales(restaurantId);
  const { data: categories = [] } = useCategories(restaurantId);
  const { data: domiciliarios = [] } = useDomiciliarios(restaurantId);
  const { data: mesas = [] } = useMesas(dineInEnabled ? restaurantId : undefined);
  const { data: restaurant } = useRestaurant(restaurantId || undefined);

  const canDelete = user?.role === 'restaurant_admin' || user?.role === 'super_admin';

  // Se guarda el id (no el pedido): el panel siempre muestra la versión en vivo
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ order: Order; addProducts: boolean } | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [manualType, setManualType] = useState<BoardColumnKey | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Re-render cada minuto para que "hace X min" de las tarjetas avance
  const [, setTick] = useState(0);

  const knownIdsRef = useRef<Set<string> | null>(null);
  const toastCounterRef = useRef(0);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  const { announce, enabled: voiceEnabled, toggle: toggleVoice } = useVoiceNotifications();
  const { showToast } = useToastStore();

  const receivedStatusId = statuses.find((s) => s.code === 'received')?.id ?? '';
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const selectedOrder = selectedOrderId ? orders.find((o) => o.id === selectedOrderId) ?? null : null;
  const occupiedTables = useMemo(() => getOccupiedTables(orders, statuses), [orders, statuses]);
  const occupiedTableIds = useMemo(() => new Set(occupiedTables.keys()), [occupiedTables]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Detect new orders and status changes
  useEffect(() => {
    if (isLoading) return;
    const currentIds = new Set(orders.map((o) => o.id));

    if (knownIdsRef.current === null) {
      // Primera carga: registrar IDs y estados sin notificar
      knownIdsRef.current = currentIds;
      prevStatusRef.current = new Map(orders.map((o) => [o.id, o.statusId]));
      return;
    }

    // Pedidos nuevos
    const newOrders = orders.filter((o) => !knownIdsRef.current!.has(o.id));
    if (newOrders.length > 0) {
      if (!voiceEnabled) playNotificationSound();
      newOrders.forEach((o) => {
        const id = ++toastCounterRef.current;
        setToasts((prev) => [...prev, { id, orderNumber: o.orderNumber }]);
      });
      if (newOrders.length === 1) {
        announce(newOrders[0].orderNumber.replace(/^#/, ''));
      } else {
        announce(`${newOrders.length} pedidos nuevos`);
      }
    }

    knownIdsRef.current = currentIds;
    prevStatusRef.current = new Map(orders.map((o) => [o.id, o.statusId]));
  }, [orders, isLoading, statuses, announce, voiceEnabled]);

  // Al tocar el aviso push se llega con ?pedido={id}: se abre el detalle de ese pedido una sola vez
  const openedFromPushRef = useRef(false);
  useEffect(() => {
    if (isLoading || openedFromPushRef.current) return;
    const url = new URL(window.location.href);
    const orderId = url.searchParams.get('pedido');
    if (!orderId) return;
    openedFromPushRef.current = true;
    if (orders.some((o) => o.id === orderId)) setSelectedOrderId(orderId);
    url.searchParams.delete('pedido');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [isLoading, orders]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const closeDrawer = useCallback(() => setSelectedOrderId(null), []);

  // Activos primero (más antiguos arriba: se atienden en orden de llegada); finalizados al final
  const columns = useMemo(() => {
    const byColumn = new Map<BoardColumnKey, { order: Order; finished: boolean }[]>(
      COLUMNS.map((c) => [c.key, []]),
    );
    for (const order of orders) {
      const finished = isOrderFinished(order, statuses);
      if (finished && !showFinished) continue;
      byColumn.get(getBoardColumn(order))!.push({ order, finished });
    }
    byColumn.forEach((list) => {
      list.sort((a, b) => Number(a.finished) - Number(b.finished) || a.order.createdAt.localeCompare(b.order.createdAt));
    });
    return byColumn;
  }, [orders, statuses, showFinished]);

  const visibleColumns = COLUMNS.filter((c) => c.key !== 'mesa' || dineInEnabled || (columns.get('mesa')?.length ?? 0) > 0);
  const activeCount = orders.filter((o) => !isOrderFinished(o, statuses)).length;

  function selectPreset(preset: Exclude<PresetKey, 'custom'>) {
    const range = getPresetRange(preset);
    setActiveRange({ preset, ...range });
  }

  function applyCustomRange(from: string, to: string) {
    setCustomFrom(from);
    setCustomTo(to);
    const start = startOfDayISO(new Date(from + 'T00:00:00'));
    const end = endOfDayISO(new Date(to + 'T00:00:00'));
    setActiveRange({ preset: 'custom', start, end });
  }

  async function handleDeleteConfirm(orderId: string, reason: string) {
    if (!user) return;
    setIsDeleting(true);
    try {
      const orderNumber = deletingOrder?.orderNumber ?? '';
      await ordersService.softDelete(restaurantId, orderId, user.uid, reason);
      setDeletingOrder(null);
      if (selectedOrderId === orderId) setSelectedOrderId(null);
      showToast(`Pedido ${orderNumber} eliminado`);
    } finally {
      setIsDeleting(false);
    }
  }

  if (!restaurantId) {
    return <p className="text-sm text-red-600">Tu cuenta no tiene un restaurante asignado.</p>;
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[var(--t-text-1)]">Pedidos en vivo</h2>
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              <Wifi className="h-3 w-3" />
              En vivo
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[var(--t-text-3)]">
            {activeCount} pedido{activeCount !== 1 ? 's' : ''} activo{activeCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {can('orders.create') && (
            <button
              onClick={() => setManualType('recoger')}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Nuevo pedido
            </button>
          )}
          <button
            onClick={playNotificationSound}
            title="Probar sonido"
            className="flex items-center gap-2 rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2 text-sm font-medium text-[var(--t-text-2)] transition-colors hover:bg-[var(--t-surface-2)]"
          >
            🔔
          </button>
          <button
            onClick={toggleVoice}
            title={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              voiceEnabled
                ? 'border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100'
                : 'border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text-4)] hover:bg-[var(--t-surface-2)]'
            }`}
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">{voiceEnabled ? 'Voz activa' : 'Voz off'}</span>
          </button>
          {/* PWA: instalar la app y avisos con la app cerrada */}
          <PwaControls />
          <button
            onClick={() => {
              knownIdsRef.current = null;
              setRefreshKey((k) => k + 1);
            }}
            className="flex items-center gap-2 rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2 text-sm font-medium text-[var(--t-text-2)] transition-colors hover:bg-[var(--t-surface-2)]"
          >
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </button>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Presets */}
        <div className="join">
          {(
            [
              { key: 'today', label: 'Hoy' },
              { key: 'yesterday', label: 'Ayer' },
              { key: 'last7', label: 'Últ. 7 días' },
              { key: 'thisMonth', label: 'Este mes' },
            ] as { key: Exclude<PresetKey, 'custom'>; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => selectPreset(key)}
              className={`btn join-item btn-sm border-base-300 ${activeRange.preset === key ? 'border-0 text-white' : 'btn-ghost'}`}
              style={activeRange.preset === key ? { background: '#FF6A1A' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom date range picker */}
        <DateRangePicker
          from={customFrom}
          to={customTo}
          isActive={activeRange.preset === 'custom'}
          onApply={applyCustomRange}
        />

        {/* Badge rango activo */}
        <div className="badge badge-lg gap-1.5 border-orange-200 bg-orange-50 py-3 font-semibold text-orange-600">
          <CalendarDays className="h-3 w-3" />
          {formatRangeLabel(activeRange)}
        </div>

        {/* Entregados, cancelados y mesas liberadas */}
        <button
          onClick={() => setShowFinished((v) => !v)}
          className={`ml-auto flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
            showFinished
              ? 'border-orange-300 bg-orange-50 text-orange-600'
              : 'border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text-3)] hover:bg-[var(--t-surface-2)]'
          }`}
        >
          {showFinished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showFinished ? 'Ocultar finalizados' : 'Ver finalizados'}
        </button>
      </div>

      {/* Tablero: una columna por tipo de pedido */}
      <div
        className="grid min-h-[60vh] flex-1 gap-3"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 260px), 1fr))` }}
      >
        {visibleColumns.map(({ key, label, empty, color, icon: Icon }) => {
          const list = columns.get(key) ?? [];
          const count = list.filter((x) => !x.finished).length;
          return (
            <section
              key={key}
              aria-label={label}
              className="flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface-2)]/40"
            >
              <header className="flex items-center gap-2 border-b border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-2.5">
                <Icon className="h-4 w-4" style={{ color }} />
                <span className="text-sm font-bold" style={{ color }}>{label}</span>
                <span className="rounded-full bg-[var(--t-surface-2)] px-2 py-0.5 text-[11px] font-bold text-[var(--t-text-3)]">{count}</span>
                {can('orders.create') && (
                  <button
                    onClick={() => setManualType(key)}
                    aria-label={`Nuevo pedido: ${label}`}
                    className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--t-border)] text-[var(--t-text-3)] transition-colors hover:bg-[var(--t-surface-2)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </header>

              <div className="flex-1 overflow-y-auto p-2.5">
                {list.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[var(--t-text-4)]">{empty}</p>
                ) : (
                  <div
                    className={key === 'mesa' ? 'grid gap-2' : 'space-y-2'}
                    style={key === 'mesa' ? { gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' } : undefined}
                  >
                    {list.map(({ order, finished }) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        status={statusById.get(order.statusId)}
                        selected={order.id === selectedOrderId}
                        finished={finished}
                        onOpen={(o) => setSelectedOrderId(o.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Panel lateral del pedido: todas las acciones según el tipo */}
      <OrderDrawer
        order={selectedOrder}
        orders={orders}
        statuses={statuses}
        restaurantId={restaurantId}
        domiciliarios={domiciliarios}
        mesas={mesas}
        paymentMethods={restaurant?.paymentMethods}
        canDelete={canDelete}
        onClose={closeDrawer}
        onEdit={(order, options) => setEditing({ order, addProducts: !!options?.addProducts })}
        onDelete={setDeletingOrder}
      />

      {/* Modal editar pedido */}
      {editing && (
        <EditOrderModal
          order={editing.order}
          initialAddProduct={editing.addProducts}
          restaurantId={restaurantId}
          products={products}
          adicionales={adicionales}
          categories={categories}
          paymentMethods={restaurant?.paymentMethods}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}

      {/* Modal pedido manual */}
      <ManualOrderModal
        isOpen={manualType !== null}
        initialDeliveryType={manualType ?? 'recoger'}
        onClose={() => setManualType(null)}
        restaurantId={restaurantId}
        receivedStatusId={receivedStatusId}
        products={products}
        adicionales={adicionales}
        categories={categories}
        paymentMethods={restaurant?.paymentMethods}
        mesas={mesas}
        occupiedTableIds={occupiedTableIds}
        dineInEnabled={dineInEnabled}
      />

      {/* Modal eliminar pedido */}
      <DeleteOrderModal
        order={deletingOrder}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeletingOrder(null)}
      />

      {/* Toasts nuevos pedidos */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
