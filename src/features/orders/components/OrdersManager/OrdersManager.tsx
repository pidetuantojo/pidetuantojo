'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingBag,
  Wifi,
  RefreshCw,
  Plus,
  X,
  GripVertical,
  Volume2,
  VolumeX,
  CalendarDays,
} from 'lucide-react';
import { DateRangePicker } from '@/components/ui/DateRangePicker/DateRangePicker';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useDraggable,
  useSensors,
  useSensor,
  pointerWithin,
} from '@dnd-kit/core';

import { useAuth } from '@/features/auth';
import { useOrderStatuses } from '@/features/order-statuses/hooks/useOrderStatuses';
import { useProducts } from '@/features/products/hooks/useProducts';
import { useAdicionales } from '@/features/adicionales/hooks/useAdicionales';
import { useCategories } from '@/features/categories';
import { useDomiciliarios } from '@/features/delivery-zones/hooks/useDomiciliarios';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import type { Order } from '@/types';

import { useOrders } from '../../hooks/useOrders';
import { useUpdateOrderStatus } from '../../hooks/useUpdateOrderStatus';
import { useVoiceNotifications } from '../../hooks/useVoiceNotifications';
import { PwaControls } from '@/features/pwa/components/PwaControls';
import { ordersService } from '../../services/orders.service';
import { useToastStore } from '@/store/toast.store';
import { OrderCard } from '../OrderCard';
import { OrderDetailModal } from '../OrderDetailModal';
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

// ── Droppable column ─────────────────────────────────────────────────────────

function DroppableColumn({
  statusId,
  children,
  color,
}: {
  statusId: string;
  children: React.ReactNode;
  color: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statusId });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 space-y-3 rounded-2xl p-2 transition-all duration-150 ${isOver ? 'ring-2 ring-offset-2' : ''}`}
      style={{
        backgroundColor: `${color}18`,
        ...(isOver ? { ringColor: color } : {}),
        outline: isOver ? `2px solid ${color}` : 'none',
        outlineOffset: isOver ? 2 : 0,
      }}
    >
      {children}
    </div>
  );
}

// ── Draggable card ────────────────────────────────────────────────────────────

function DraggableCard({
  canDrag,
  ...props
}: React.ComponentProps<typeof OrderCard> & { canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.order.id,
    disabled: !canDrag,
  });
  // Sin permiso para cambiar estados la tarjeta no se arrastra
  if (!canDrag) return <OrderCard {...props} />;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.35 : 1, cursor: isDragging ? 'grabbing' : 'grab' }}
      className="group relative"
    >
      <div className="pointer-events-none absolute right-10 top-3 z-10 rounded-lg p-1 text-[var(--t-text-4)] opacity-0 transition-opacity group-hover:text-[var(--t-text-3)] group-hover:opacity-100">
        <GripVertical className="h-4 w-4" />
      </div>
      <OrderCard {...props} />
    </div>
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

// ── Main component ────────────────────────────────────────────────────────────

export function OrdersManager() {
  const { user, can } = useAuth();
  const canChangeStatus = can('orders.change_status');
  const restaurantId = user?.restaurantId ?? '';

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
  const { data: restaurant } = useRestaurant(restaurantId || undefined);
  const { updateStatus } = useUpdateOrderStatus(restaurantId);

  const canDelete = user?.role === 'restaurant_admin' || user?.role === 'super_admin';

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dragError, setDragError] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const knownIdsRef = useRef<Set<string> | null>(null);
  const toastCounterRef = useRef(0);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  const { announce, enabled: voiceEnabled, toggle: toggleVoice } = useVoiceNotifications();
  const { showToast } = useToastStore();

  const boardScrollRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, width: 0, client: 0 });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const receivedStatusId = statuses.find((s) => s.code === 'received')?.id ?? '';

  const activeStatuses = statuses
    .filter((s) => s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
      playNotificationSound();
      newOrders.forEach((o) => {
        const id = ++toastCounterRef.current;
        setToasts((prev) => [...prev, { id, orderNumber: o.orderNumber }]);
      });
      if (newOrders.length === 1) {
        announce(`Nuevo pedido de ${newOrders[0].customerName}`);
      } else {
        announce(`${newOrders.length} pedidos nuevos`);
      }
    }

    // Cambios de estado en pedidos ya conocidos
    orders.forEach((order) => {
      if (!knownIdsRef.current!.has(order.id)) return; // skip nuevos
      const prev = prevStatusRef.current.get(order.id);
      if (prev !== undefined && prev !== order.statusId) {
        const statusName = statuses.find((s) => s.id === order.statusId)?.name;
        if (statusName) announce(`Pedido de ${order.customerName}: ${statusName}`);
      }
    });

    knownIdsRef.current = currentIds;
    prevStatusRef.current = new Map(orders.map((o) => [o.id, o.statusId]));
  }, [orders, isLoading, statuses, announce]);

  // Al tocar el aviso push se llega con ?pedido={id}: se abre el detalle de ese pedido una sola vez
  const openedFromPushRef = useRef(false);
  useEffect(() => {
    if (isLoading || openedFromPushRef.current) return;
    const url = new URL(window.location.href);
    const orderId = url.searchParams.get('pedido');
    if (!orderId) return;
    openedFromPushRef.current = true;
    const order = orders.find((o) => o.id === orderId);
    if (order) setSelectedOrder(order);
    url.searchParams.delete('pedido');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [isLoading, orders]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const syncScroll = useCallback(() => {
    const el = boardScrollRef.current;
    if (!el) return;
    setScroll({ left: el.scrollLeft, width: el.scrollWidth, client: el.clientWidth });
  }, []);

  // Re-medir cuando cargan las columnas (statuses) o cambia el filtro
  useEffect(() => {
    const id = setTimeout(syncScroll, 0);
    window.addEventListener('resize', syncScroll);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', syncScroll);
    };
  }, [orders, activeRange, statuses, syncScroll]);

  // rAF loop — detecta cambios en scrollLeft sin depender del evento scroll
  useEffect(() => {
    let rafId: number;
    let lastLeft = -1;
    const tick = () => {
      const el = boardScrollRef.current;
      if (el && el.scrollLeft !== lastLeft) {
        lastLeft = el.scrollLeft;
        syncScroll();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [syncScroll]);

  const hasOverflow = scroll.width > scroll.client;
  const thumbWpx = hasOverflow ? (scroll.client / scroll.width) * scroll.client : 0;
  const thumbLpx = hasOverflow
    ? (scroll.left / (scroll.width - scroll.client)) * (scroll.client - thumbWpx)
    : 0;

  function handleThumbMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startLeft = scroll.left;
    const scrollRange = scroll.width - scroll.client;
    const thumbRange = scroll.client - thumbWpx;
    const onMove = (ev: MouseEvent) => {
      if (!boardScrollRef.current) return;
      boardScrollRef.current.scrollLeft =
        startLeft + ((ev.clientX - startX) / thumbRange) * scrollRange;
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // El rango ya viene filtrado desde Firestore; no hace falta filtrar de nuevo
  const filteredOrders = orders;

  const ordersByStatus = (statusId: string) =>
    filteredOrders.filter((o) => o.statusId === statusId);

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

  async function handleAdvance(orderId: string, nextStatusId: string) {
    const order = filteredOrders.find((o) => o.id === orderId);
    const newStatus = statuses.find((s) => s.id === nextStatusId);
    await updateStatus(orderId, nextStatusId, order && newStatus ? {
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      statusName: newStatus.name,
      statusCode: newStatus.code,
      items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
      paymentMethod: order.paymentMethod,
      total: order.total,
    } : undefined);
  }

  async function handleDeleteConfirm(orderId: string, reason: string) {
    if (!user) return;
    setIsDeleting(true);
    try {
      const orderNumber = deletingOrder?.orderNumber ?? '';
      await ordersService.softDelete(restaurantId, orderId, user.uid, reason);
      setDeletingOrder(null);
      showToast(`Pedido ${orderNumber} eliminado`);
    } finally {
      setIsDeleting(false);
    }
  }

  // Drag handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveOrderId(String(event.active.id));
    setDragError(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveOrderId(null);
    const { active, over } = event;
    if (!over) return;

    const order = filteredOrders.find((o) => o.id === String(active.id));
    if (!order || !canChangeStatus) return;

    const newStatusId = String(over.id);
    if (order.statusId === newStatusId) return;

    try {
      const newStatus = statuses.find((s) => s.id === newStatusId);
      await updateStatus(order.id, newStatusId, newStatus ? {
        customerPhone: order.customerPhone,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        statusName: newStatus.name,
        statusCode: newStatus.code,
        items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
        paymentMethod: order.paymentMethod,
        total: order.total,
      } : undefined);
    } catch {
      setDragError('No se pudo mover el pedido. Intenta de nuevo.');
      setTimeout(() => setDragError(null), 3000);
    }
  }

  const activeOrder = activeOrderId ? filteredOrders.find((o) => o.id === activeOrderId) : null;
  const activeOrderStatus = activeOrder
    ? activeStatuses.find((s) => s.id === activeOrder.statusId)
    : undefined;

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
    <div className="h-full space-y-5">
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
            {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''} activos
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {can('orders.create') && (
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Pedido manual
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
      </div>

      {/* Error de drag */}
      {dragError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dragError}
        </div>
      )}

      {/* Kanban con DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Scrollbar custom arriba — solo se muestra cuando hay overflow */}
        {hasOverflow && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              height: 8,
              background: 'var(--t-border-2)',
              borderRadius: 999,
              margin: '12px 0 4px',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              const el = boardScrollRef.current;
              if (!el) return;
              const rect = e.currentTarget.getBoundingClientRect();
              el.scrollLeft =
                ((e.clientX - rect.left) / rect.width) * (el.scrollWidth - el.clientWidth);
            }}
          >
            <div
              onMouseDown={handleThumbMouseDown}
              style={{
                position: 'absolute',
                top: 0,
                height: '100%',
                background: 'var(--t-text-3)',
                borderRadius: 999,
                width: thumbWpx,
                left: thumbLpx,
                cursor: 'grab',
              }}
            />
          </div>
        )}

        <style>{`#orders-board::-webkit-scrollbar { display: none; }`}</style>
        <div
          id="orders-board"
          ref={boardScrollRef}
          className="relative flex gap-4 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {activeStatuses.map((status) => {
            const columnOrders = ordersByStatus(status.id);
            return (
              <div key={status.id} className="w-72 flex-shrink-0">
                {/* Column header */}
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="font-semibold text-[var(--t-text-1)]">{status.name}</span>
                  {columnOrders.length > 0 && (
                    <span className="ml-auto rounded-full bg-[var(--t-surface-2)] px-2 py-0.5 text-xs font-bold text-[var(--t-text-2)]">
                      {columnOrders.length}
                    </span>
                  )}
                </div>

                {/* Column body — droppable */}
                <DroppableColumn statusId={status.id} color={status.color}>
                  {columnOrders.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-sm text-[var(--t-text-4)]">
                      <div className="text-center">
                        <ShoppingBag className="mx-auto mb-2 h-6 w-6 opacity-30" />
                        <span>Sin pedidos</span>
                      </div>
                    </div>
                  ) : (
                    columnOrders.map((order) => (
                      <DraggableCard
                        key={order.id}
                        canDrag={canChangeStatus}
                        order={order}
                        status={status}
                        statuses={activeStatuses}
                        restaurantId={restaurantId}
                        domiciliarios={domiciliarios}
                        onOpen={setSelectedOrder}
                        onAdvance={canChangeStatus ? handleAdvance : undefined}
                        onEdit={can('orders.edit') ? setEditingOrder : undefined}
                        onDelete={setDeletingOrder}
                        canDelete={canDelete}
                      />
                    ))
                  )}
                </DroppableColumn>
              </div>
            );
          })}

          {activeStatuses.length === 0 && (
            <div className="flex flex-1 items-center justify-center py-16 text-center">
              <div>
                <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-[var(--t-text-4)]" />
                <p className="text-[var(--t-text-3)]">No hay estados configurados.</p>
              </div>
            </div>
          )}
        </div>

        {/* Ghost card mientras se arrastra */}
        <DragOverlay dropAnimation={null}>
          {activeOrder ? (
            <div className="pointer-events-none rotate-1 scale-105 rounded-2xl opacity-95 shadow-2xl">
              <OrderCard
                order={activeOrder}
                status={activeOrderStatus}
                statuses={activeStatuses}
                restaurantId={restaurantId}
                domiciliarios={domiciliarios}
                onOpen={() => {}}
                onAdvance={() => {}}
                onEdit={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal de detalle */}
      <OrderDetailModal
        order={selectedOrder}
        statuses={statuses}
        products={products}
        restaurantId={restaurantId}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      {/* Modal editar pedido */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          restaurantId={restaurantId}
          products={products}
          adicionales={adicionales}
          categories={categories}
          paymentMethods={restaurant?.paymentMethods}
          onClose={() => setEditingOrder(null)}
          onSaved={() => setEditingOrder(null)}
        />
      )}

      {/* Modal pedido manual */}
      <ManualOrderModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        restaurantId={restaurantId}
        receivedStatusId={receivedStatusId}
        products={products}
        adicionales={adicionales}
        categories={categories}
        paymentMethods={restaurant?.paymentMethods}
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
