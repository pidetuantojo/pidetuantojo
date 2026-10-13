'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight, Bike, Building2, Check, Clock, CreditCard, DollarSign, LayoutGrid, MapPin,
  MessageCircle, MessageSquare, Pencil, Percent, Plus, Split, StickyNote, Trash2, Unlock,
  User, X, XCircle, CalendarClock, Send,
} from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/features/auth';
import { formatScheduledDate } from '@/features/menu/helpers/schedule.helpers';
import { PrintOrderButton } from '@/features/printers/components/PrintOrderButton';
import type { Domiciliario, Mesa, Order, OrderStatus, PaymentMethodConfig } from '@/types';

import { getBoardColumn, getOccupiedTables, isOrderFinished } from '../../helpers/board.helpers';
import { buildDriverMessage } from '../../helpers/driver.helpers';
import { buildPaymentMessage, paidAmount, remainingAmount } from '../../helpers/payments.helpers';
import { formatShortDate, timeAgo } from '../../helpers/time.helpers';
import { getOrderTotals } from '../../helpers/totals.helpers';
import { useUpdateOrderStatus } from '../../hooks/useUpdateOrderStatus';
import { ordersService } from '../../services/orders.service';
import { StatusBadge } from '../OrderCard/OrderCard';
import { DiscountDialog, DriverDialog, TransferItemDialog, TransferTableDialog } from './dialogs';
import { PaymentDialog } from './PaymentDialog';
import { ActionTile } from './ui';

const DELIVERY_PHONE = process.env.NEXT_PUBLIC_DELIVERY_PHONE ?? '';

export interface OrderDrawerProps {
  // Versión en vivo del pedido abierto (null = cerrado)
  order: Order | null;
  // Todos los pedidos del tablero: mesas ocupadas y destinos para trasladar productos
  orders: Order[];
  statuses: OrderStatus[];
  restaurantId: string;
  domiciliarios: Domiciliario[];
  mesas: Mesa[];
  paymentMethods?: PaymentMethodConfig[];
  canDelete: boolean;
  onClose: () => void;
  onEdit: (order: Order, options?: { addProducts?: boolean }) => void;
  onDelete: (order: Order) => void;
}

type Dialog =
  | { type: 'pay' | 'split' | 'discount' | 'table' | 'driver' }
  | { type: 'item'; index: number };

function waLink(phone: string, text?: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

function InfoRow({ icon, children, onEdit }: { icon: React.ReactNode; children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="mt-0.5 flex-shrink-0 text-[var(--t-text-4)]">{icon}</span>
      <div className="min-w-0 flex-1 text-sm text-[var(--t-text-1)]">{children}</div>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label="Editar" className="flex-shrink-0 rounded-lg p-1 text-[var(--t-text-4)] hover:bg-[var(--t-surface-2)] hover:text-[#FF6A1A]">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function OrderDrawer(props: OrderDrawerProps) {
  const { order, onClose } = props;

  // Escape cierra el panel (los diálogos internos capturan su propio Escape)
  useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, onClose]);

  if (!order) return null;
  // key: al cambiar de pedido se reinician los estados de edición
  return <DrawerContent key={order.id} {...props} order={order} />;
}

function DrawerContent({
  order, orders, statuses, restaurantId, domiciliarios, mesas, paymentMethods, canDelete, onClose, onEdit, onDelete,
}: OrderDrawerProps & { order: Order }) {
  const { can } = useAuth();
  const canEdit = can('orders.edit');
  const canChangeStatus = can('orders.change_status');
  const canSetFee = can('orders.set_delivery_fee');
  const canMarkPaid = can('orders.mark_paid');
  const canManageNotes = can('orders.manage_notes');
  const canAssignDriver = can('orders.assign_driver');
  const companiesEnabled = can('features.delivery_companies');
  const { updateStatus, isPending: statusPending, error: statusError } = useUpdateOrderStatus(restaurantId);

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [confirm, setConfirm] = useState<'cancel' | 'release' | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const [editingFee, setEditingFee] = useState(false);
  const [feeInput, setFeeInput] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState(order.internalNote ?? '');

  useEffect(() => {
    if (!editingNote) setNoteInput(order.internalNote ?? '');
  }, [order.internalNote, editingNote]);

  const column = getBoardColumn(order);
  const isMesa = column === 'mesa';
  const isDomicilio = column === 'domicilio';
  const totals = getOrderTotals(order);
  const paid = paidAmount(order);
  const remaining = remainingAmount(order);
  const promoDiscount = Math.max(0, totals.discount - (order.manualDiscount ?? 0));
  const status = statuses.find((s) => s.id === order.statusId);
  const cancelledStatus = statuses.find((s) => s.code === 'cancelled');
  const deliveredStatus = statuses.find((s) => s.code === 'delivered');
  const finished = isOrderFinished(order, statuses);
  const pills = statuses
    .filter((s) => s.isActive && s.code !== 'cancelled')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const occupied = useMemo(() => getOccupiedTables(orders, statuses), [orders, statuses]);
  const otherOpenTables = useMemo(
    () => Array.from(occupied.values()).filter((o) => o.id !== order.id),
    [occupied, order.id],
  );

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setActionError('');
    try {
      await fn();
    } catch {
      setActionError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: OrderStatus) {
    if (!canChangeStatus || next.id === order.statusId) return;
    await updateStatus(order.id, next.id, {
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      statusName: next.name,
      statusCode: next.code,
      items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
      paymentMethod: order.paymentMethod,
      total: totals.total,
    });
  }

  async function handleCancel() {
    if (!cancelledStatus) return;
    await changeStatus(cancelledStatus);
    setConfirm(null);
  }

  async function handleRelease() {
    await run(() => ordersService.releaseTable(
      restaurantId, order.id, status?.code === 'delivered' ? undefined : deliveredStatus?.id,
    ));
    setConfirm(null);
    onClose();
  }

  async function handleSaveFee() {
    const value = parseInt(feeInput.replace(/\D/g, ''), 10);
    if (Number.isNaN(value) || value < 0) return;
    await run(() => ordersService.updateDeliveryFee(restaurantId, order.id, value, order));
    setEditingFee(false);
  }

  async function handleSaveNote() {
    await run(() => ordersService.updateInternalNote(restaurantId, order.id, noteInput.trim()));
    setEditingNote(false);
  }

  async function handleRemoveItem(index: number) {
    await run(() => ordersService.updateItems(restaurantId, order, order.items.filter((_, i) => i !== index)));
    setRemoveIndex(null);
  }

  const statusMessage = `Hola ${order.customerName}! Tu pedido ${order.orderNumber} está ahora en estado: *${status?.name ?? ''}*`;
  const driverPhone = order.assignedDriver?.phone ?? DELIVERY_PHONE;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Pedido ${order.orderNumber}`}
        className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-[420px] flex-col bg-[var(--t-surface)] shadow-2xl"
        style={{ animation: 'order-drawer-in .22s ease-out' }}
      >
        <style>{`@keyframes order-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[var(--t-border)] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="font-mono text-lg font-extrabold text-[var(--t-text-1)]">#{order.orderNumber}</span>
            <StatusBadge status={status} />
            {isMesa && order.tableName && (
              <span className="truncate rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{order.tableName}</span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--t-text-3)] hover:bg-[var(--t-surface-2)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo: datos + productos */}
        <div className="min-h-[160px] flex-1 overflow-y-auto px-5 py-3">
          <div className="divide-y divide-[var(--t-border)]/60">
            <InfoRow icon={<User className="h-4 w-4" />} onEdit={canEdit ? () => onEdit(order) : undefined}>
              <p className="font-semibold">{order.customerName}</p>
              <a href={waLink(order.customerPhone)} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--t-text-3)] hover:text-emerald-600">
                {order.customerPhone}
              </a>
            </InfoRow>

            <InfoRow icon={<CreditCard className="h-4 w-4" />} onEdit={canEdit ? () => onEdit(order) : undefined}>
              <div className="flex items-center justify-between gap-2">
                <span>
                  {order.paymentMethod}
                  {order.paymentAccount && <span className="text-xs text-[var(--t-text-4)]"> · {order.paymentAccount}</span>}
                </span>
                {canMarkPaid ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => ordersService.updateIsPaid(restaurantId, order.id, !order.isPaid))}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${order.isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-[#FF6A1A]'}`}
                    title="Marcar pagado / pendiente"
                  >
                    {order.isPaid ? 'Pagado ✓' : 'Pendiente'}
                  </button>
                ) : (
                  <span className={`text-[10px] font-bold ${order.isPaid ? 'text-emerald-600' : 'text-[#FF6A1A]'}`}>{order.isPaid ? 'Pagado' : 'Pendiente'}</span>
                )}
              </div>
            </InfoRow>

            {isMesa && (
              <InfoRow icon={<LayoutGrid className="h-4 w-4" />}>
                <span className="font-semibold text-emerald-700">{order.tableName ?? 'Sin mesa'}</span>
              </InfoRow>
            )}

            {isDomicilio && (
              <InfoRow icon={<MapPin className="h-4 w-4" />} onEdit={canEdit ? () => onEdit(order) : undefined}>
                <p>{order.customerAddress || 'Sin dirección'}</p>
                {order.barrio && <p className="text-xs text-[var(--t-text-3)]">Barrio: {order.barrio}</p>}
                {order.location && (
                  <a
                    href={`https://maps.google.com/?q=${order.location.lat},${order.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-bold text-blue-600 hover:underline"
                  >
                    Ver ubicación en mapa
                  </a>
                )}
              </InfoRow>
            )}

            {isDomicilio && (
              <InfoRow icon={<Bike className="h-4 w-4" />}>
                {editingFee ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--t-text-4)]">Envío $</span>
                    <input
                      inputMode="numeric"
                      autoFocus
                      value={feeInput}
                      onChange={(e) => setFeeInput(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFee(); if (e.key === 'Escape') { e.stopPropagation(); setEditingFee(false); } }}
                      aria-label="Valor del domicilio"
                      className="w-24 border-b-2 border-[#FF6A1A] bg-transparent text-sm font-bold tabular-nums outline-none"
                    />
                    <button type="button" onClick={handleSaveFee} disabled={busy} className="rounded-lg bg-[#FF6A1A] px-2 py-0.5 text-xs font-bold text-white disabled:opacity-50">OK</button>
                    <button type="button" onClick={() => setEditingFee(false)} aria-label="Cancelar" className="text-[var(--t-text-4)]"><XCircle className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      Envío:{' '}
                      {order.freeDelivery && totals.deliveryFee === 0
                        ? <b className="text-emerald-600">Gratis (promo)</b>
                        : <b>{formatCurrency(totals.deliveryFee)}</b>}
                    </span>
                    {canSetFee && (
                      <button
                        type="button"
                        onClick={() => { setFeeInput(totals.deliveryFee > 0 ? String(totals.deliveryFee) : ''); setEditingFee(true); }}
                        aria-label="Editar valor del domicilio"
                        className="rounded-lg p-1 text-[var(--t-text-4)] hover:bg-[var(--t-surface-2)] hover:text-[#FF6A1A]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </InfoRow>
            )}

            <InfoRow icon={<Clock className="h-4 w-4" />}>
              <span className="text-[var(--t-text-2)]">{timeAgo(order.createdAt)} · {formatShortDate(order.createdAt)}</span>
            </InfoRow>

            {order.isScheduled && order.scheduledFor && (
              <InfoRow icon={<CalendarClock className="h-4 w-4 text-violet-500" />}>
                <span className="font-semibold text-violet-700">Programado: {formatScheduledDate(new Date(order.scheduledFor))}</span>
              </InfoRow>
            )}

            {order.notes && (
              <InfoRow icon={<MessageSquare className="h-4 w-4" />}>
                <span className="text-[var(--t-text-2)]">{order.notes}</span>
              </InfoRow>
            )}

            {(canManageNotes || order.internalNote) && (
              <InfoRow icon={<StickyNote className="h-4 w-4 text-amber-400" />}>
                {editingNote ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={noteInput}
                      autoFocus
                      rows={2}
                      onChange={(e) => setNoteInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditingNote(false); } }}
                      placeholder="Nota interna..."
                      aria-label="Nota interna"
                      className="w-full resize-none rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-[var(--t-text-1)] outline-none"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => setEditingNote(false)} className="px-2 py-1 text-xs font-bold text-[var(--t-text-4)]">Cancelar</button>
                      <button type="button" onClick={handleSaveNote} disabled={busy} className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                        <Check className="h-3 w-3" /> Guardar
                      </button>
                    </div>
                  </div>
                ) : canManageNotes ? (
                  <button type="button" onClick={() => setEditingNote(true)} className="text-left text-xs text-amber-700 hover:text-amber-900">
                    {order.internalNote || <span className="text-[var(--t-text-4)]">Agregar nota interna</span>}
                  </button>
                ) : (
                  <span className="text-xs text-amber-700">{order.internalNote}</span>
                )}
              </InfoRow>
            )}
          </div>

          {/* Productos */}
          <p className="mb-1 mt-4 text-[10px] font-bold uppercase tracking-widest text-[var(--t-text-4)]">Productos</p>
          <div className="divide-y divide-[var(--t-border)]/60">
            {order.items.map((item, i) => (
              <div key={`${item.productId}-${i}`} className="flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--t-text-1)]">
                    <span className="text-[#2563eb]">{item.quantity}x</span> {item.isGift && '🎁 '}{item.productName}
                  </p>
                  {item.additionals.length > 0 && (
                    <p className="text-[11px] text-[var(--t-text-3)]">+ {item.additionals.map((a) => a.name).join(', ')}</p>
                  )}
                  {item.specialInstructions && <p className="text-[11px] italic text-[var(--t-text-3)]">“{item.specialInstructions}”</p>}
                  {!!item.discount && <p className="text-[11px] text-emerald-600">🏷 {item.promotionName ?? 'Promoción'} −{formatCurrency(item.discount)}</p>}
                </div>
                <span className="flex-shrink-0 pt-0.5 text-sm font-bold tabular-nums text-[var(--t-text-1)]">
                  {item.isGift ? 'Regalo' : formatCurrency(item.subtotal)}
                </span>
                {canEdit && !finished && (
                  removeIndex === i ? (
                    <div className="flex flex-shrink-0 gap-1">
                      <button type="button" onClick={() => handleRemoveItem(i)} disabled={busy} aria-label="Confirmar quitar" className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white disabled:opacity-50">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setRemoveIndex(null)} aria-label="No quitar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--t-border)] text-[var(--t-text-3)]">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-shrink-0 gap-1">
                      <button type="button" onClick={() => onEdit(order)} aria-label={`Editar ${item.productName}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--t-border)] text-[var(--t-text-2)] hover:bg-[var(--t-surface-2)]">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {isMesa && (
                        <button type="button" onClick={() => setDialog({ type: 'item', index: i })} aria-label={`Trasladar ${item.productName} a otra mesa`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--t-border)] text-[var(--t-text-2)] hover:bg-[var(--t-surface-2)]">
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRemoveIndex(i)}
                        disabled={order.items.length === 1}
                        title={order.items.length === 1 ? 'Es el único producto: cancela el pedido' : undefined}
                        aria-label={`Quitar ${item.productName}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--t-border)] text-[var(--t-text-2)] hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>

          {/* Totales y pagos */}
          <div className="mt-2 space-y-1 border-t border-[var(--t-border)] pt-3 text-sm">
            {(totals.discount > 0 || totals.deliveryFee > 0) && (
              <div className="flex justify-between text-[var(--t-text-3)]"><span>Productos</span><span>{formatCurrency(totals.productsTotal)}</span></div>
            )}
            {promoDiscount > 0 && (
              <div className="flex justify-between text-emerald-600"><span>Promociones</span><span>−{formatCurrency(promoDiscount)}</span></div>
            )}
            {!!order.manualDiscount && (
              <div className="flex items-center justify-between text-emerald-600">
                <span>Descuento{order.manualDiscountReason ? ` · ${order.manualDiscountReason}` : ''}</span>
                <span className="flex items-center gap-1">
                  −{formatCurrency(order.manualDiscount)}
                  {canEdit && (
                    <button type="button" onClick={() => run(() => ordersService.setManualDiscount(restaurantId, order, 0))} aria-label="Quitar descuento" className="text-emerald-400 hover:text-red-500">
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </div>
            )}
            {totals.deliveryFee > 0 && (
              <div className="flex justify-between text-[var(--t-text-3)]"><span>Envío</span><span>{formatCurrency(totals.deliveryFee)}</span></div>
            )}
            <div className="flex justify-between pt-1 text-base font-extrabold text-[var(--t-text-1)]">
              <span>Total</span><span>{formatCurrency(totals.total)}</span>
            </div>
            {(order.payments ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs text-emerald-700">
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" /> {p.method}{p.label ? ` · ${p.label}` : ''}
                  {p.received && p.received > p.amount ? <span className="text-[var(--t-text-4)]"> (cambio {formatCurrency(p.received - p.amount)})</span> : null}
                </span>
                <span className="flex items-center gap-1">
                  {formatCurrency(p.amount)}
                  {canMarkPaid && (
                    <button type="button" onClick={() => run(() => ordersService.removePayment(restaurantId, order, p.id))} aria-label="Anular pago" className="text-emerald-300 hover:text-red-500">
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </div>
            ))}
            {paid > 0 && remaining > 0 && (
              <div className="flex justify-between text-xs font-bold text-[#FF6A1A]"><span>Pendiente</span><span>{formatCurrency(remaining)}</span></div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="max-h-[58%] flex-shrink-0 space-y-2 overflow-y-auto border-t border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-3">
          <div className="grid grid-cols-4 gap-2">
            <PrintOrderButton order={order} restaurantId={restaurantId} variant="tile" />
            {canEdit && !finished && (
              <ActionTile icon={<Plus className="h-4 w-4" />} label="Agregar" tone="teal" onClick={() => onEdit(order, { addProducts: true })} />
            )}
            {canEdit && !finished && (
              <ActionTile icon={<Percent className="h-4 w-4" />} label="Descuento" tone="green" onClick={() => setDialog({ type: 'discount' })} />
            )}
            <ActionTile
              icon={<MessageCircle className="h-4 w-4" />}
              label="WhatsApp"
              tone="green"
              onClick={() => window.open(waLink(order.customerPhone, statusMessage), '_blank')}
            />
          </div>

          {!isMesa && (
            <button
              type="button"
              onClick={() => window.open(waLink(order.customerPhone, buildPaymentMessage(order)), '_blank')}
              className="flex w-full flex-col items-center gap-0.5 rounded-xl border border-emerald-300 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <MessageCircle className="h-4 w-4" /> Notif. pago
            </button>
          )}

          {isMesa && canMarkPaid && remaining > 0 && (
            <button
              type="button"
              onClick={() => setDialog({ type: 'split' })}
              className="flex w-full flex-col items-center gap-0.5 rounded-xl border border-[var(--t-border)] py-2 text-[11px] font-semibold text-violet-700 hover:bg-violet-50"
            >
              <Split className="h-4 w-4" /> Dividir
            </button>
          )}

          {/* Estados */}
          {canChangeStatus && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {pills.map((s) => {
                const current = s.id === order.statusId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={statusPending || current}
                    onClick={() => changeStatus(s)}
                    className="rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors disabled:cursor-default"
                    style={current
                      ? { background: s.color, borderColor: s.color, color: '#fff' }
                      : { borderColor: `${s.color}99`, color: s.color, opacity: statusPending ? 0.5 : 1 }}
                  >
                    {isMesa && s.code === 'delivered' ? 'Entregar a mesa' : s.name}{current ? ' ✓' : ''}
                  </button>
                );
              })}
              {cancelledStatus && order.statusId !== cancelledStatus.id && (
                confirm === 'cancel' ? (
                  <span className="ml-auto flex items-center gap-1.5 text-xs">
                    <span className="font-semibold text-red-500">¿Cancelar pedido?</span>
                    <button type="button" onClick={handleCancel} disabled={statusPending} className="rounded-full bg-red-500 px-2.5 py-1 font-bold text-white">Sí</button>
                    <button type="button" onClick={() => setConfirm(null)} className="rounded-full border border-[var(--t-border)] px-2.5 py-1 font-bold text-[var(--t-text-3)]">No</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirm('cancel')} className="ml-auto rounded-full border-2 border-red-300 px-3 py-1 text-xs font-bold text-red-500 hover:bg-red-50">
                    Cancelar
                  </button>
                )
              )}
            </div>
          )}
          {statusError && <p className="text-xs text-red-500">{statusError}</p>}

          {/* Domiciliario */}
          {isDomicilio && (
            order.assignedDriver ? (
              <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100">
                  {order.assignedDriver.isCompany ? <Building2 className="h-4 w-4 text-indigo-600" /> : <Bike className="h-4 w-4 text-indigo-600" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-indigo-900">{order.assignedDriver.name}</p>
                  <p className="truncate text-[10px] text-indigo-500">
                    {[order.assignedDriver.courierName, order.assignedDriver.code, order.assignedDriver.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {canAssignDriver && (
                  <>
                    <button type="button" onClick={() => setDialog({ type: 'driver' })} aria-label="Cambiar domiciliario" className="text-indigo-300 hover:text-indigo-600"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => run(() => ordersService.updateDriver(restaurantId, order.id, null))} aria-label="Quitar domiciliario" className="text-indigo-300 hover:text-indigo-600"><XCircle className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ) : canAssignDriver ? (
              <button
                type="button"
                onClick={() => setDialog({ type: 'driver' })}
                className="flex w-full flex-col items-center gap-0.5 rounded-xl border-2 border-violet-200 bg-violet-50 py-2.5 text-xs font-bold text-violet-700 hover:bg-violet-100"
              >
                <Bike className="h-4 w-4" /> Asignar domiciliario
              </button>
            ) : null
          )}
          {isDomicilio && driverPhone && (canAssignDriver || order.assignedDriver) && (
            <a
              href={waLink(driverPhone, buildDriverMessage(order, { isPaid: !!order.isPaid, grandTotal: remaining || totals.total, note: order.internalNote }))}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
            >
              <Send className="h-4 w-4" />
              <span className="truncate">{order.assignedDriver ? `Enviar a ${order.assignedDriver.courierName ?? order.assignedDriver.name}` : 'Enviar a domiciliario'}</span>
            </a>
          )}

          {/* Pago y mesa */}
          <div className="flex gap-2">
            {canMarkPaid && (
              remaining > 0 ? (
                <button
                  type="button"
                  onClick={() => setDialog({ type: 'pay' })}
                  className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  <DollarSign className="h-4 w-4" />
                  Pagar{paid > 0 ? ` ${formatCurrency(remaining)}` : ''}
                </button>
              ) : (
                <div className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700">
                  <Check className="h-4 w-4" /> Pagado
                </div>
              )
            )}
            {isMesa && canEdit && !finished && (
              <button
                type="button"
                onClick={() => setDialog({ type: 'table' })}
                className="flex flex-1 flex-col items-center gap-0.5 rounded-xl border-2 border-violet-300 bg-violet-50 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100"
              >
                <ArrowLeftRight className="h-4 w-4" /> Trasladar mesa
              </button>
            )}
          </div>

          {isMesa && canChangeStatus && !order.tableReleasedAt && (
            confirm === 'release' ? (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">
                  {remaining > 0
                    ? `La cuenta tiene ${formatCurrency(remaining)} pendientes. ¿Liberar la mesa igual?`
                    : '¿Liberar la mesa? El pedido sale del tablero.'}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirm(null)} className="flex-1 rounded-lg border border-amber-200 bg-white py-1.5 text-xs font-bold text-amber-700">No</button>
                  <button type="button" onClick={handleRelease} disabled={busy} className="flex-1 rounded-lg bg-amber-500 py-1.5 text-xs font-bold text-white disabled:opacity-50">Sí, liberar</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirm('release')}
                className="flex w-full flex-col items-center gap-0.5 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
              >
                <Unlock className="h-4 w-4" /> Liberar mesa
              </button>
            )
          )}

          {actionError && <p role="alert" className="text-xs text-red-500">{actionError}</p>}

          {canDelete && (
            <button type="button" onClick={() => onDelete(order)} className="mx-auto flex items-center gap-1 pt-1 text-[11px] font-semibold text-[var(--t-text-4)] hover:text-red-500">
              <Trash2 className="h-3 w-3" /> Eliminar pedido
            </button>
          )}
        </div>
      </aside>

      {dialog?.type === 'pay' || dialog?.type === 'split' ? (
        <PaymentDialog order={order} restaurantId={restaurantId} paymentMethods={paymentMethods} mode={dialog.type} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.type === 'discount' && <DiscountDialog order={order} restaurantId={restaurantId} onClose={() => setDialog(null)} />}
      {dialog?.type === 'table' && (
        <TransferTableDialog order={order} restaurantId={restaurantId} mesas={mesas} occupied={occupied} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'item' && (
        <TransferItemDialog order={order} itemIndex={dialog.index} restaurantId={restaurantId} targets={otherOpenTables} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'driver' && (
        <DriverDialog order={order} restaurantId={restaurantId} domiciliarios={domiciliarios} companiesEnabled={companiesEnabled} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
