'use client';

import { useMemo, useState } from 'react';

import { ImageUpload } from '@/components/ui/ImageUpload';
import { formatCurrency } from '@/lib/utils';
import type { Category, OrderDeliveryType, Product, Promotion, PromotionType, SavePromotionData } from '@/types';

import {
  DELIVERY_TYPE_LABEL, describePromotion, promotionBadge, PROMOTION_TYPE_LABEL, WEEKDAY_SHORT,
} from '../../engine';
import {
  EMPTY_PROMOTION_FORM, formToPromotion, parseAmount, PROMOTION_STEP_LABEL, PROMOTION_STEPS,
  validatePromotionForm, validatePromotionStep, type PromotionFormState, type PromotionStep,
} from '../../helpers/promotionForm';

const sg = 'var(--font-sans, sans-serif)';
const sm = 'var(--font-mono, monospace)';
const ORANGE = '#FF6A1A';

const TYPE_OPTIONS: { type: PromotionType; emoji: string; goal: string; advanced?: boolean }[] = [
  { type: 'item_discount', emoji: '🏷️', goal: 'Precio tachado en productos o categorías. Ideal para mover días flojos o sacar inventario.' },
  { type: 'order_discount', emoji: '💸', goal: 'Descuento al total del pedido, con pedido mínimo. Sube el ticket promedio.' },
  { type: 'free_delivery', emoji: '🛵', goal: 'Domicilio gratis desde cierto monto. El clásico para subir el ticket.' },
  { type: 'bundle', emoji: '2️⃣', goal: '2x1, 3x2… en productos o categorías. Perfecto para días flojos.', advanced: true },
  { type: 'combo', emoji: '🍔', goal: 'Varios productos juntos por un precio fijo (ej. hamburguesa + papas + gaseosa).', advanced: true },
  { type: 'gift', emoji: '🎁', goal: 'Un producto de regalo con la compra (ej. gaseosa gratis desde $35.000).', advanced: true },
];

const DELIVERY_TYPES: OrderDeliveryType[] = ['recoger', 'domicilio', 'mesa'];
// Lunes primero (como en el calendario colombiano)
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', borderRadius: 10,
  padding: '10px 12px', fontSize: 14, fontFamily: sg, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box',
};

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ display: 'block', fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: 'var(--t-text-3)', textTransform: 'uppercase' }}>{children}</span>
      {hint && <span style={{ display: 'block', fontSize: 12, color: 'var(--t-text-4)', marginTop: 2 }}>{hint}</span>}
    </div>
  );
}

function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        padding: '7px 12px', borderRadius: 999, fontFamily: sg, fontSize: 13, fontWeight: active ? 700 : 500,
        border: `1.5px solid ${active ? ORANGE : 'var(--t-border)'}`,
        background: active ? `${ORANGE}14` : 'var(--t-surface)', color: active ? ORANGE : 'var(--t-text-2)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2, accentColor: ORANGE }} />
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--t-text-1)' }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 12, color: 'var(--t-text-3)', marginTop: 1 }}>{hint}</span>}
      </span>
    </label>
  );
}

function MoneyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-text-4)', fontSize: 14 }}>$</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingLeft: 24 }}
      />
    </div>
  );
}

interface PromotionWizardProps {
  initial?: PromotionFormState;
  // Al editar: id de la promoción (permite guardar desde cualquier paso)
  editingId?: string;
  products: Product[];
  categories: Category[];
  otherPromotions: Promotion[];
  advancedEnabled: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (data: SavePromotionData) => Promise<void> | void;
}

export function PromotionWizard({ initial, editingId, products, categories, otherPromotions, advancedEnabled, saving, onCancel, onSave }: PromotionWizardProps) {
  const [form, setForm] = useState<PromotionFormState>(initial ?? EMPTY_PROMOTION_FORM);
  const [step, setStep] = useState<PromotionStep>(editingId ? 'detail' : 'type');
  const [error, setError] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const set = <K extends keyof PromotionFormState>(key: K, value: PromotionFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };
  const toggleIn = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const ctx = { advancedEnabled, otherPromotions, editingId };
  const stepIndex = PROMOTION_STEPS.indexOf(step);
  const isLast = stepIndex === PROMOTION_STEPS.length - 1;
  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const names = useMemo(() => ({
    products: new Map(products.map((p) => [p.id, p.name])),
    categories: new Map(categories.map((c) => [c.id, c.name])),
  }), [products, categories]);
  const filteredProducts = activeProducts.filter((p) => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()));

  function next() {
    const message = validatePromotionStep(step, form, ctx);
    if (message) { setError(message); return; }
    if (step === 'detail' && !form.name.trim()) set('name', suggestName());
    setStep(PROMOTION_STEPS[stepIndex + 1]);
  }

  async function save() {
    const invalid = validatePromotionForm(form, ctx);
    if (invalid) { setStep(invalid.step); setError(invalid.message); return; }
    await onSave(formToPromotion(form));
  }

  // Nombre sugerido a partir del detalle (el restaurante lo puede cambiar)
  function suggestName(): string {
    if (!form.type) return '';
    try {
      const preview = { ...formToPromotion({ ...form, name: 'x' }), id: 'preview', restaurantId: '', usesCount: 0, createdAt: '', updatedAt: '' } as Promotion;
      switch (form.type) {
        case 'free_delivery': return form.minSubtotal ? `Domicilio gratis desde ${formatCurrency(parseAmount(form.minSubtotal) ?? 0)}` : 'Domicilio gratis';
        case 'combo': return 'Combo especial';
        case 'gift': return `Regalo: ${productById.get(form.giftProductId)?.name ?? 'producto'}`;
        default: return describePromotion(preview, names).split(' · ')[0].slice(0, 60);
      }
    } catch {
      return '';
    }
  }

  const comboNormalPrice = form.comboItems.reduce((acc, c) => acc + (productById.get(c.productId)?.price ?? 0) * c.quantity, 0);
  const preview: Promotion | null = (() => {
    if (!form.type) return null;
    try {
      return { ...formToPromotion({ ...form, name: form.name || suggestName() || 'Promoción' }), id: 'preview', restaurantId: '', usesCount: 0, createdAt: '', updatedAt: '' };
    } catch {
      return null;
    }
  })();

  // ─── Pasos ─────────────────────────────────────────────────────────────────

  const targetPicker = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Label>¿A qué aplica?</Label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: -4 }}>
        <Chip active={form.targetScope === 'all'} onClick={() => set('targetScope', 'all')}>Todo el menú</Chip>
        <Chip active={form.targetScope === 'categories'} onClick={() => set('targetScope', 'categories')}>Categorías</Chip>
        <Chip active={form.targetScope === 'products'} onClick={() => set('targetScope', 'products')}>Productos</Chip>
      </div>
      {form.targetScope === 'categories' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.filter((c) => c.isActive).map((c) => (
            <Chip key={c.id} active={form.categoryIds.includes(c.id)} onClick={() => set('categoryIds', toggleIn(form.categoryIds, c.id))}>{c.name}</Chip>
          ))}
        </div>
      )}
      {form.targetScope === 'products' && productList((id) => form.productIds.includes(id), (id) => set('productIds', toggleIn(form.productIds, id)))}
    </div>
  );

  function productList(isSelected: (id: string) => boolean, onToggle: (id: string) => void, single = false) {
    return (
      <div>
        <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar producto..." style={{ ...inputStyle, marginBottom: 6 }} />
        <div style={{ maxHeight: '40vh', overflowY: 'auto', border: '1px solid var(--t-border)', borderRadius: 10 }}>
          {filteredProducts.length === 0 && <p style={{ margin: 0, padding: 12, fontSize: 13, color: 'var(--t-text-4)' }}>Sin productos</p>}
          {filteredProducts.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--t-border)', cursor: 'pointer', fontSize: 13 }}>
              <input type={single ? 'radio' : 'checkbox'} checked={isSelected(p.id)} onChange={() => onToggle(p.id)} style={{ accentColor: ORANGE }} />
              <span style={{ flex: 1, color: 'var(--t-text-1)' }}>{p.name}{!p.isAvailable && <span style={{ color: 'var(--t-text-4)' }}> (agotado)</span>}</span>
              <span style={{ color: 'var(--t-text-3)', fontWeight: 600 }}>{formatCurrency(p.price)}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  const discountFields = (allowFixed: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Label>Tipo de descuento</Label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: -4 }}>
        <Chip active={form.discountKind === 'percent'} onClick={() => set('discountKind', 'percent')}>Porcentaje (%)</Chip>
        <Chip active={form.discountKind === 'amount'} onClick={() => set('discountKind', 'amount')}>Monto fijo ($)</Chip>
        {allowFixed && <Chip active={form.discountKind === 'fixed_price'} onClick={() => set('discountKind', 'fixed_price')}>Precio final</Chip>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: form.discountKind === 'percent' ? '1fr 1fr' : '1fr', gap: 10, alignItems: 'end' }}>
        <div>
          <Label>{form.discountKind === 'percent' ? 'Porcentaje' : form.discountKind === 'fixed_price' ? 'Precio de la oferta' : 'Valor del descuento'}</Label>
          {form.discountKind === 'percent' ? (
            <div style={{ position: 'relative' }}>
              <input inputMode="numeric" value={form.discountValue} onChange={(e) => set('discountValue', e.target.value.replace(/[^\d]/g, ''))} placeholder="20" style={{ ...inputStyle, paddingRight: 28 }} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-text-4)' }}>%</span>
            </div>
          ) : (
            <MoneyInput value={form.discountValue} onChange={(v) => set('discountValue', v)} placeholder={form.discountKind === 'fixed_price' ? '19900' : '5000'} />
          )}
        </div>
        {form.discountKind === 'percent' && (
          <div>
            <Label hint="Opcional">Tope del descuento</Label>
            <MoneyInput value={form.maxDiscount} onChange={(v) => set('maxDiscount', v)} placeholder="Sin tope" />
          </div>
        )}
      </div>
    </div>
  );

  function renderStep() {
    switch (step) {
      case 'type':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {TYPE_OPTIONS.map((o) => {
              const locked = o.advanced && !advancedEnabled;
              const active = form.type === o.type;
              return (
                <button
                  key={o.type}
                  type="button"
                  disabled={locked}
                  onClick={() => set('type', o.type)}
                  style={{
                    textAlign: 'left', padding: 14, borderRadius: 14, cursor: locked ? 'not-allowed' : 'pointer', fontFamily: sg,
                    border: `2px solid ${active ? ORANGE : 'var(--t-border)'}`, background: active ? `${ORANGE}10` : 'var(--t-surface)',
                    opacity: locked ? 0.55 : 1, display: 'flex', flexDirection: 'column', gap: 4,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{o.emoji}</span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--t-text-1)' }}>{PROMOTION_TYPE_LABEL[o.type]}</span>
                  <span style={{ fontSize: 12, color: 'var(--t-text-3)', lineHeight: 1.45 }}>{o.goal}</span>
                  {locked && <span style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, color: ORANGE }}>PLAN AVANZADO</span>}
                </button>
              );
            })}
          </div>
        );

      case 'detail':
        switch (form.type) {
          case 'item_discount':
            return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{targetPicker}{discountFields(true)}</div>;
          case 'order_discount':
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {discountFields(false)}
                <Toggle
                  checked={form.stackable}
                  onChange={(v) => set('stackable', v)}
                  label="Se suma a los productos en oferta"
                  hint="Si está apagado, el descuento no se aplica sobre productos que ya tienen precio tachado, 2x1 o combo."
                />
                <p style={{ margin: 0, fontSize: 12, color: 'var(--t-text-3)' }}>El pedido mínimo se configura en el paso de condiciones.</p>
              </div>
            );
          case 'free_delivery':
            return (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--t-text-2)', lineHeight: 1.6 }}>
                El domicilio queda en <strong>$0</strong> para los pedidos que cumplan las condiciones. En el siguiente paso eliges
                desde qué valor de pedido aplica (recomendado: algo un poco por encima de tu ticket promedio).
              </p>
            );
          case 'bundle':
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <Label>Promoción</Label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[['2', '1'], ['3', '2'], ['4', '3']].map(([buy, pay]) => (
                      <Chip key={buy} active={form.buyQuantity === buy && form.payQuantity === pay} onClick={() => { set('buyQuantity', buy); set('payQuantity', pay); }}>{buy}x{pay}</Chip>
                    ))}
                    <span style={{ fontSize: 13, color: 'var(--t-text-3)' }}>o lleva</span>
                    <input inputMode="numeric" value={form.buyQuantity} onChange={(e) => set('buyQuantity', e.target.value.replace(/[^\d]/g, ''))} style={{ ...inputStyle, width: 60 }} aria-label="Lleva" />
                    <span style={{ fontSize: 13, color: 'var(--t-text-3)' }}>paga</span>
                    <input inputMode="numeric" value={form.payQuantity} onChange={(e) => set('payQuantity', e.target.value.replace(/[^\d]/g, ''))} style={{ ...inputStyle, width: 60 }} aria-label="Paga" />
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--t-text-3)' }}>Las unidades más baratas son las que salen gratis.</p>
                </div>
                {targetPicker}
              </div>
            );
          case 'combo':
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Label hint="Elige los productos y cuántos de cada uno lleva el combo">Productos del combo</Label>
                {productList(
                  (id) => form.comboItems.some((c) => c.productId === id),
                  (id) => set('comboItems', form.comboItems.some((c) => c.productId === id)
                    ? form.comboItems.filter((c) => c.productId !== id)
                    : [...form.comboItems, { productId: id, quantity: 1 }]),
                )}
                {form.comboItems.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {form.comboItems.map((c) => (
                      <div key={c.productId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input
                          inputMode="numeric"
                          value={c.quantity}
                          aria-label={`Cantidad de ${productById.get(c.productId)?.name}`}
                          onChange={(e) => set('comboItems', form.comboItems.map((x) => x.productId === c.productId ? { ...x, quantity: Math.max(1, Number(e.target.value.replace(/[^\d]/g, '')) || 1) } : x))}
                          style={{ ...inputStyle, width: 56, padding: '6px 8px' }}
                        />
                        <span style={{ flex: 1, color: 'var(--t-text-1)' }}>x {productById.get(c.productId)?.name ?? 'Producto eliminado'}</span>
                      </div>
                    ))}
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--t-text-3)' }}>Precio normal: {formatCurrency(comboNormalPrice)}</p>
                  </div>
                )}
                <div>
                  <Label>Precio del combo</Label>
                  <MoneyInput value={form.comboPrice} onChange={(v) => set('comboPrice', v)} placeholder="28000" />
                  {!!parseAmount(form.comboPrice) && comboNormalPrice > 0 && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: (parseAmount(form.comboPrice) ?? 0) < comboNormalPrice ? '#059669' : '#dc2626' }}>
                      {(parseAmount(form.comboPrice) ?? 0) < comboNormalPrice
                        ? `El cliente ahorra ${formatCurrency(comboNormalPrice - (parseAmount(form.comboPrice) ?? 0))}`
                        : 'El precio del combo no es menor al precio normal: no habría descuento'}
                    </p>
                  )}
                </div>
              </div>
            );
          case 'gift':
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Label hint="Se agrega al pedido sin costo cuando el cliente cumple las condiciones">Producto de regalo</Label>
                {productList((id) => form.giftProductId === id, (id) => set('giftProductId', id), true)}
                <div style={{ maxWidth: 160 }}>
                  <Label>Cantidad</Label>
                  <input inputMode="numeric" value={form.giftQuantity} onChange={(e) => set('giftQuantity', e.target.value.replace(/[^\d]/g, ''))} style={inputStyle} />
                </div>
              </div>
            );
          default:
            return null;
        }

      case 'when':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <Label>Atajos</Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip active={!form.daysOfWeek.length && !form.startTime} onClick={() => setForm((f) => ({ ...f, daysOfWeek: [], startTime: '', endTime: '' }))}>Todos los días</Chip>
                <Chip active={form.daysOfWeek.join() === '1,2,3,4'} onClick={() => set('daysOfWeek', [1, 2, 3, 4])}>Lun a Jue (días flojos)</Chip>
                <Chip active={form.daysOfWeek.join() === '0,5,6'} onClick={() => set('daysOfWeek', [0, 5, 6])}>Fin de semana</Chip>
                <Chip active={form.startTime === '15:00' && form.endTime === '18:00'} onClick={() => setForm((f) => ({ ...f, startTime: '15:00', endTime: '18:00' }))}>Happy hour 3–6 p. m.</Chip>
              </div>
            </div>
            <div>
              <Label hint="Sin días marcados = todos los días">Días de la semana</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {WEEK_ORDER.map((d) => (
                  <Chip key={d} active={form.daysOfWeek.includes(d)} onClick={() => set('daysOfWeek', toggleIn(form.daysOfWeek, d).sort())}>{WEEKDAY_SHORT[d]}</Chip>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'end' }}>
              <div>
                <Label hint="Opcional">Desde (hora)</Label>
                <input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <Label hint="Si es menor que el inicio, cruza la medianoche">Hasta (hora)</Label>
                <input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <Label hint="Opcional">Fecha de inicio</Label>
                <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <Label hint="Opcional (incluido)">Fecha de fin</Label>
                <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} style={inputStyle} />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--t-text-3)' }}>Las horas son de Colombia. Si un cliente arma el carrito justo antes de que termine, se le respeta unos minutos.</p>
          </div>
        );

      case 'conditions':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ maxWidth: 260 }}>
              <Label hint="Productos después de los descuentos por producto. Vacío = sin mínimo">Pedido mínimo</Label>
              <MoneyInput value={form.minSubtotal} onChange={(v) => set('minSubtotal', v)} placeholder="Sin mínimo" />
            </div>
            <div>
              <Label hint="Sin marcar = todas">Formas de entrega</Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DELIVERY_TYPES.map((d) => (
                  <Chip key={d} active={form.deliveryTypes.includes(d)} onClick={() => set('deliveryTypes', toggleIn(form.deliveryTypes, d))}>{DELIVERY_TYPE_LABEL[d]}</Chip>
                ))}
              </div>
            </div>
            <div style={{ maxWidth: 260 }}>
              <Label hint='Ej: "las primeras 50". Vacío = sin límite'>Límite total de usos</Label>
              <input inputMode="numeric" value={form.maxUses} onChange={(e) => set('maxUses', e.target.value.replace(/[^\d]/g, ''))} placeholder="Sin límite" style={inputStyle} />
            </div>

            <div style={{ borderTop: '1px solid var(--t-border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: advancedEnabled ? 'var(--t-text-3)' : ORANGE }}>
                {advancedEnabled ? 'CUPÓN Y CLIENTES' : 'CUPÓN Y CLIENTES — PLAN AVANZADO'}
              </span>
              <div style={{ maxWidth: 260 }}>
                <Label hint="Solo aplica si el cliente escribe el código. No se muestra en el menú">Código de cupón (opcional)</Label>
                <input
                  value={form.couponCode}
                  disabled={!advancedEnabled}
                  onChange={(e) => set('couponCode', e.target.value.toUpperCase().replace(/\s/g, ''))}
                  placeholder="INSTA10"
                  style={{ ...inputStyle, letterSpacing: '.06em', opacity: advancedEnabled ? 1 : 0.5 }}
                />
              </div>
              <Toggle
                checked={form.firstOrderOnly}
                disabled={!advancedEnabled}
                onChange={(v) => set('firstOrderOnly', v)}
                label="Solo para el primer pedido"
                hint="Se identifica al cliente por su celular. Úsalo con descuentos moderados: alguien podría escribir otro número."
              />
              <div style={{ maxWidth: 260 }}>
                <Label hint="Vacío = sin límite">Usos por cliente</Label>
                <input
                  inputMode="numeric"
                  value={form.maxUsesPerCustomer}
                  disabled={!advancedEnabled}
                  onChange={(e) => set('maxUsesPerCustomer', e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="Sin límite"
                  style={{ ...inputStyle, opacity: advancedEnabled ? 1 : 0.5 }}
                />
              </div>
            </div>
          </div>
        );

      case 'presentation':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Label>Nombre visible para el cliente</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.name} maxLength={60} onChange={(e) => set('name', e.target.value)} placeholder="Ej: Martes de 2x1 en hamburguesas" style={inputStyle} />
                <button type="button" onClick={() => set('name', suggestName())} style={{ flexShrink: 0, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', borderRadius: 10, padding: '0 12px', fontFamily: sg, fontSize: 12, fontWeight: 600, color: 'var(--t-text-2)', cursor: 'pointer' }}>
                  Sugerir
                </button>
              </div>
            </div>
            <div>
              <Label hint="Opcional. Si lo dejas vacío se muestra el resumen automático">Texto corto</Label>
              <textarea value={form.description} maxLength={140} rows={2} onChange={(e) => set('description', e.target.value)} placeholder="Ej: Solo martes y miércoles de 3 a 6 p. m." style={{ ...inputStyle, resize: 'none' }} />
            </div>
            <ImageUpload value={form.image} onChange={(url) => set('image', url)} label="Imagen (opcional)" aspectRatio="square" />
            <Toggle
              checked={form.showInMenu && !form.couponCode}
              disabled={!!form.couponCode}
              onChange={(v) => set('showInMenu', v)}
              label="Mostrar en el banner del menú"
              hint={form.couponCode ? 'Las promociones con cupón no se muestran (se revelaría el código).' : 'Aparece arriba del menú. El precio tachado y el 2x1 se ven igual en cada producto.'}
            />
            <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Activa" hint="Puedes pausarla cuando quieras sin borrarla." />

            {preview && (
              <div style={{ border: '1px dashed var(--t-border)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--t-text-3)' }}>VISTA PREVIA</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: `linear-gradient(135deg, ${ORANGE}, #1B1512)`, color: '#fff', borderRadius: 16, padding: 12 }}>
                  {form.image
                    ? <img src={form.image} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', background: '#fff' }} />
                    : <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{promotionBadge(preview)}</div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{preview.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>{form.description || describePromotion(preview, names)}</div>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--t-text-3)' }}>Resumen: {describePromotion(preview, names)}</span>
              </div>
            )}
          </div>
        );
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
    >
      <div role="dialog" aria-modal="true" aria-label={editingId ? 'Editar promoción' : 'Nueva promoción'} style={{ background: 'var(--t-surface)', borderRadius: 20, width: '75vw', maxWidth: '100%', height: '75vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', fontFamily: sg }}>
        {/* Encabezado + pasos */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--t-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--t-text-1)' }}>
              {editingId ? 'Editar promoción' : 'Nueva promoción'}
              {form.type && <span style={{ fontWeight: 500, color: 'var(--t-text-3)' }}> · {PROMOTION_TYPE_LABEL[form.type]}</span>}
            </h3>
            <button type="button" onClick={onCancel} disabled={saving} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'var(--t-surface-2)', cursor: 'pointer', color: 'var(--t-text-3)', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {PROMOTION_STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => { if (i < stepIndex || editingId) { setStep(s); setError(''); } }}
                style={{ flex: 1, background: 'none', border: 'none', padding: 0, cursor: i < stepIndex || editingId ? 'pointer' : 'default', textAlign: 'left' }}
              >
                <div style={{ height: 4, borderRadius: 999, background: i <= stepIndex ? ORANGE : 'var(--t-border)' }} />
                <span style={{ display: 'block', marginTop: 4, fontSize: 11, fontWeight: s === step ? 700 : 500, color: s === step ? 'var(--t-text-1)' : 'var(--t-text-4)' }}>
                  {i + 1}. {PROMOTION_STEP_LABEL[s]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>{renderStep()}</div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--t-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => (stepIndex === 0 ? onCancel() : (setStep(PROMOTION_STEPS[stepIndex - 1]), setError('')))}
              disabled={saving}
              style={{ flex: 1, padding: 10, borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', fontFamily: sg, fontWeight: 600, fontSize: 14, color: 'var(--t-text-3)', cursor: 'pointer' }}
            >
              {stepIndex === 0 ? 'Cancelar' : 'Atrás'}
            </button>
            {editingId && !isLast && (
              <button type="button" onClick={save} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1.5px solid ${ORANGE}`, background: 'var(--t-surface)', color: ORANGE, fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Guardar
              </button>
            )}
            <button
              type="button"
              onClick={isLast ? save : next}
              disabled={saving}
              style={{ flex: 2, padding: 10, borderRadius: 999, border: 'none', background: ORANGE, color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Guardando...' : isLast ? (editingId ? 'Guardar cambios' : 'Crear promoción') : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
