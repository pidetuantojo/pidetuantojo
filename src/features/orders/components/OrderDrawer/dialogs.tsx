'use client';

import { useState } from 'react';
import { Bike, Building2, LayoutGrid, Minus, Plus, Search } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { AssignedDriver, Domiciliario, Mesa, Order } from '@/types';

import { applyManualDiscount, percentToAmount } from '../../helpers/amounts.helpers';
import { toAssignedDriver, validateCourierName } from '../../helpers/driver.helpers';
import { ordersService } from '../../services/orders.service';
import { DialogButton, DrawerDialog, MoneyInput, toInt } from './ui';

function useSaving() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function run(fn: () => Promise<void>, onDone: () => void) {
    setSaving(true);
    setError('');
    try {
      await fn();
      onDone();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }
  return { saving, error, run };
}

// ── Descuento ─────────────────────────────────────────────────────────────────

export function DiscountDialog({ order, restaurantId, onClose }: { order: Order; restaurantId: string; onClose: () => void }) {
  const [unit, setUnit] = useState<'amount' | 'percent'>('amount');
  const [value, setValue] = useState(order.manualDiscount ? String(order.manualDiscount) : '');
  const [reason, setReason] = useState(order.manualDiscountReason ?? '');
  const { saving, error, run } = useSaving();

  const amount = unit === 'percent' ? percentToAmount(order, toInt(value)) : toInt(value);
  const preview = applyManualDiscount(order, amount);

  return (
    <DrawerDialog
      title="Descuento"
      subtitle={`Pedido #${order.orderNumber}`}
      onClose={onClose}
      footer={
        <>
          {order.manualDiscount ? (
            <DialogButton tone="ghost" disabled={saving} onClick={() => run(() => ordersService.setManualDiscount(restaurantId, order, 0), onClose)}>
              Quitar descuento
            </DialogButton>
          ) : (
            <DialogButton tone="ghost" onClick={onClose}>Cancelar</DialogButton>
          )}
          <DialogButton
            disabled={saving || amount <= 0}
            onClick={() => run(() => ordersService.setManualDiscount(restaurantId, order, amount, reason), onClose)}
          >
            {saving ? 'Guardando...' : 'Aplicar'}
          </DialogButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--t-surface-2)] p-1">
          {(['amount', 'percent'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => { setUnit(u); setValue(''); }}
              className={`rounded-lg py-1.5 text-xs font-bold ${unit === u ? 'bg-[var(--t-surface)] text-[#FF6A1A] shadow-sm' : 'text-[var(--t-text-3)]'}`}
            >
              {u === 'amount' ? 'Valor ($)' : 'Porcentaje (%)'}
            </button>
          ))}
        </div>
        {unit === 'amount' ? (
          <MoneyInput value={value} onChange={setValue} autoFocus />
        ) : (
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--t-input-border)] bg-[var(--t-input-bg)] px-3 py-2">
            <input
              inputMode="numeric"
              autoFocus
              value={value}
              onChange={(e) => setValue(String(Math.min(100, toInt(e.target.value))))}
              placeholder="10"
              aria-label="Porcentaje de descuento"
              className="w-full bg-transparent text-sm font-bold text-[var(--t-text-1)] outline-none"
            />
            <span className="text-sm text-[var(--t-text-4)]">%</span>
          </div>
        )}
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional): cliente frecuente, cortesía..."
          aria-label="Motivo del descuento"
          className="w-full rounded-xl border border-[var(--t-input-border)] bg-[var(--t-input-bg)] px-3 py-2 text-sm text-[var(--t-text-1)] outline-none"
        />
        <div className="space-y-1 rounded-xl bg-[var(--t-surface-2)] p-3 text-sm">
          <div className="flex justify-between text-[var(--t-text-3)]"><span>Descuento</span><span>−{formatCurrency(preview.manualDiscount)}</span></div>
          <div className="flex justify-between font-bold text-[var(--t-text-1)]"><span>Nuevo total</span><span className="text-[#FF6A1A]">{formatCurrency(preview.total)}</span></div>
        </div>
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      </div>
    </DrawerDialog>
  );
}

// ── Trasladar mesa ────────────────────────────────────────────────────────────

export function TransferTableDialog({
  order, restaurantId, mesas, occupied, onClose,
}: {
  order: Order;
  restaurantId: string;
  mesas: Mesa[];
  // tableId → pedido que la ocupa
  occupied: Map<string, Order>;
  onClose: () => void;
}) {
  const { saving, error, run } = useSaving();
  const options = mesas.filter((m) => m.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <DrawerDialog title="Trasladar mesa" subtitle={`${order.tableName ?? 'Mesa'} · Comanda ${order.orderNumber}`} onClose={onClose}>
      {options.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--t-text-4)]">No hay mesas configuradas.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {options.map((m) => {
            const current = m.id === order.tableId;
            const busy = !current ? occupied.get(m.id) : undefined;
            return (
              <button
                key={m.id}
                type="button"
                disabled={saving || current || !!busy}
                onClick={() => run(() => ordersService.moveTable(restaurantId, order.id, m), onClose)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors disabled:cursor-default ${
                  current ? 'border-[#FF6A1A] bg-orange-50 text-[#FF6A1A]'
                    : busy ? 'border-[var(--t-border)] bg-[var(--t-surface-2)] text-[var(--t-text-4)] opacity-70'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="text-xs font-bold">{m.name}</span>
                <span className="text-[10px]">{current ? 'Actual' : busy ? 'Ocupada' : 'Libre'}</span>
              </button>
            );
          })}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-red-500">{error}</p>}
    </DrawerDialog>
  );
}

// ── Trasladar producto a otra mesa ────────────────────────────────────────────

export function TransferItemDialog({
  order, itemIndex, restaurantId, targets, onClose,
}: {
  order: Order;
  itemIndex: number;
  restaurantId: string;
  // Otras mesas abiertas
  targets: Order[];
  onClose: () => void;
}) {
  const item = order.items[itemIndex];
  const [qty, setQty] = useState(item?.quantity ?? 1);
  const [targetId, setTargetId] = useState('');
  const { saving, error, run } = useSaving();
  const target = targets.find((t) => t.id === targetId);
  if (!item) return null;

  const isWholeOrder = order.items.length === 1 && qty === item.quantity;

  return (
    <DrawerDialog
      title="Trasladar producto"
      subtitle={`${item.quantity}x ${item.productName}`}
      onClose={onClose}
      footer={
        <>
          <DialogButton tone="ghost" onClick={onClose}>Cancelar</DialogButton>
          <DialogButton
            disabled={saving || !target || isWholeOrder}
            onClick={() => target && run(() => ordersService.transferItem(restaurantId, order, itemIndex, qty, target), onClose)}
          >
            {saving ? 'Trasladando...' : 'Trasladar'}
          </DialogButton>
        </>
      }
    >
      <div className="space-y-4">
        {item.quantity > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--t-text-2)]">Cantidad a pasar</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--t-border)]"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
              <button type="button" aria-label="Más" onClick={() => setQty((q) => Math.min(item.quantity, q + 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--t-border)]"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--t-text-2)]">¿A qué mesa?</p>
          {targets.length === 0 ? (
            <p className="rounded-xl bg-[var(--t-surface-2)] py-5 text-center text-sm text-[var(--t-text-4)]">No hay otras mesas abiertas.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTargetId(t.id)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center ${
                    targetId === t.id ? 'border-[#FF6A1A] bg-orange-50 text-[#FF6A1A]' : 'border-[var(--t-border)] text-[var(--t-text-2)] hover:bg-[var(--t-surface-2)]'
                  }`}
                >
                  <span className="text-xs font-bold">{t.tableName ?? 'Mesa'}</span>
                  <span className="text-[10px] text-[var(--t-text-4)]">#{t.orderNumber}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {isWholeOrder && (
          <p className="text-xs text-amber-600">Es el único producto: para mover toda la cuenta usa &quot;Trasladar mesa&quot;.</p>
        )}
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      </div>
    </DrawerDialog>
  );
}

// ── Asignar domiciliario ──────────────────────────────────────────────────────

export function DriverDialog({
  order, restaurantId, domiciliarios, companiesEnabled, onClose,
}: {
  order: Order;
  restaurantId: string;
  domiciliarios: Domiciliario[];
  companiesEnabled: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  // Empresa elegida: falta el nombre/código de quien tomó el pedido
  const [company, setCompany] = useState<{ base: AssignedDriver; value: string; error: string } | null>(
    order.assignedDriver?.isCompany ? { base: order.assignedDriver, value: order.assignedDriver.courierName ?? '', error: '' } : null,
  );
  const { saving, error, run } = useSaving();

  const q = search.trim().toLowerCase();
  const available = domiciliarios.filter(
    (d) => d.isActive && (companiesEnabled || !d.isCompany) &&
      (d.name.toLowerCase().includes(q) || (!!d.code && d.code.toLowerCase().includes(q))),
  );

  function assign(driver: AssignedDriver) {
    run(() => ordersService.updateDriver(restaurantId, order.id, driver), onClose);
  }

  function pick(d: Domiciliario) {
    if (d.isCompany) { setCompany({ base: toAssignedDriver(d), value: '', error: '' }); return; }
    assign(toAssignedDriver(d));
  }

  function saveCompany() {
    if (!company) return;
    const err = validateCourierName({ isCompany: true }, company.value);
    if (err) { setCompany({ ...company, error: err }); return; }
    assign({ ...company.base, courierName: company.value.trim() });
  }

  return (
    <DrawerDialog
      title={company ? company.base.name : 'Asignar domiciliario'}
      subtitle={`Pedido #${order.orderNumber}`}
      onClose={onClose}
      footer={company ? (
        <>
          <DialogButton tone="ghost" onClick={() => setCompany(null)}>Volver</DialogButton>
          <DialogButton onClick={saveCompany} disabled={saving}>{saving ? 'Asignando...' : 'Asignar'}</DialogButton>
        </>
      ) : undefined}
    >
      {company ? (
        <div className="space-y-2">
          <label htmlFor="courier-name" className="block text-xs font-semibold text-[var(--t-text-2)]">Domiciliario de la empresa</label>
          <input
            id="courier-name"
            autoFocus
            value={company.value}
            onChange={(e) => setCompany({ ...company, value: e.target.value, error: '' })}
            onKeyDown={(e) => { if (e.key === 'Enter') saveCompany(); }}
            placeholder="Nombre o código de quien tomó el pedido"
            className={`w-full rounded-xl border bg-[var(--t-input-bg)] px-3 py-2 text-sm text-[var(--t-text-1)] outline-none ${company.error ? 'border-red-300' : 'border-[var(--t-input-border)]'}`}
          />
          {company.error && <p className="text-xs text-red-500">{company.error}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--t-input-border)] bg-[var(--t-input-bg)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--t-text-4)]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar domiciliario o empresa..."
              aria-label="Buscar domiciliario"
              className="w-full bg-transparent text-sm text-[var(--t-text-1)] outline-none"
            />
          </div>
          {available.map((d) => (
            <button
              key={d.id}
              type="button"
              disabled={saving}
              onClick={() => pick(d)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-indigo-50 ${
                order.assignedDriver?.id === d.id ? 'border-indigo-300 bg-indigo-50' : 'border-[var(--t-border)]'
              }`}
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100">
                {d.isCompany ? <Building2 className="h-4 w-4 text-indigo-600" /> : <Bike className="h-4 w-4 text-indigo-600" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--t-text-1)]">
                  <span className="truncate">{d.name}</span>
                  {d.isCompany && <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[9px] font-bold text-indigo-600">Empresa</span>}
                </span>
                <span className="block text-[11px] text-[var(--t-text-4)]">{[d.isCompany ? undefined : d.code, d.phone].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
          {available.length === 0 && (
            <p className="py-5 text-center text-sm text-[var(--t-text-4)]">
              {domiciliarios.length === 0 ? 'No hay domiciliarios configurados.' : 'Sin resultados'}
            </p>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-red-500">{error}</p>}
    </DrawerDialog>
  );
}
