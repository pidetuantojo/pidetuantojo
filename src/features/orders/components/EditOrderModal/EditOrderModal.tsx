'use client';

import { useState } from 'react';
import { X, Plus, Minus, Save, Loader2, ShoppingBag, Truck, CreditCard, User, CalendarClock } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { Order, OrderItem, Product, Adicional, Additional, Category, PaymentMethodConfig } from '@/types';
import { PaymentMethodPicker } from '@/features/payment-methods/components/PaymentMethodPicker';
import { getActivePaymentMethods, getPaymentLabel } from '@/features/payment-methods/helpers/payment-methods.helpers';
import {
  formatScheduledDate,
  parseScheduleInput,
  toDateInputValue,
  toTimeInputValue,
} from '@/features/menu/helpers/schedule.helpers';
import { ordersService } from '../../services/orders.service';

const sg = "var(--font-sans, sans-serif)";

interface EditOrderModalProps {
  order: Order;
  restaurantId: string;
  products: Product[];
  adicionales: Adicional[];
  categories: Category[];
  paymentMethods?: PaymentMethodConfig[];
  onClose: () => void;
  onSaved: () => void;
}

interface EditableItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  additionals: Additional[];
}

const DELIVERY_TYPES = [
  { value: 'recoger' as const, label: 'Recoger', emoji: '🏪' },
  { value: 'domicilio' as const, label: 'Domicilio', emoji: '🛵' },
  { value: 'mesa' as const, label: 'En el local', emoji: '🪑' },
];

export function EditOrderModal({ order, restaurantId, products, adicionales, categories, paymentMethods, onClose, onSaved }: EditOrderModalProps) {
  const [items, setItems] = useState<EditableItem[]>(() =>
    order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      additionals: [...item.additionals],
    }))
  );

  const [customerName, setCustomerName] = useState(order.customerName);
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone);
  const [deliveryType, setDeliveryType] = useState<'recoger' | 'domicilio' | 'mesa'>(order.deliveryType ?? 'recoger');
  const [address, setAddress] = useState(order.customerAddress ?? '');
  const [barrio, setBarrio] = useState(order.barrio ?? '');
  const activePaymentMethods = getActivePaymentMethods(paymentMethods);
  // Preselecciona el método configurado que coincide con el del pedido (tipo + cuenta)
  const [paymentMethodId, setPaymentMethodId] = useState(
    () => activePaymentMethods.find(
      (m) => m.type === order.paymentMethodType && (m.account ?? '') === (order.paymentAccount ?? '')
    )?.id ?? ''
  );
  const selectedPayment = activePaymentMethods.find((m) => m.id === paymentMethodId) ?? null;
  const initialScheduled = order.isScheduled && order.scheduledFor ? new Date(order.scheduledFor) : null;
  const [isScheduled, setIsScheduled] = useState(initialScheduled !== null);
  const [scheduleDate, setScheduleDate] = useState(initialScheduled ? toDateInputValue(initialScheduled) : '');
  const [scheduleTime, setScheduleTime] = useState(initialScheduled ? toTimeInputValue(initialScheduled) : '');

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addingAdicionalFor, setAddingAdicionalFor] = useState<number | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const adicionalesMap = Object.fromEntries(adicionales.map((a) => [a.id, a]));

  const total = items.reduce((sum, item) => {
    const addTotal = item.additionals.reduce((s, a) => s + a.price, 0);
    return sum + (item.unitPrice + addTotal) * item.quantity;
  }, 0);
  // El valor del domicilio se edita desde la tarjeta; acá solo se conserva (o se quita si deja de ser domicilio)
  const deliveryFee = deliveryType === 'domicilio' ? order.deliveryFee ?? 0 : 0;

  function changeQty(index: number, delta: number) {
    setItems((prev) => {
      const next = [...prev];
      const newQty = Math.max(0, next[index].quantity + delta);
      if (newQty === 0) {
        if (addingAdicionalFor === index) setAddingAdicionalFor(null);
        return next.filter((_, i) => i !== index);
      }
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  }

  function addProduct(product: Product) {
    setItems((prev) => {
      const existing = prev.findIndex((i) => i.productId === product.id);
      if (existing !== -1) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
        return next;
      }
      return [...prev, { productId: product.id, productName: product.name, unitPrice: product.price, quantity: 1, additionals: [] }];
    });
    setShowAddProduct(false);
  }

  function removeAdditional(itemIndex: number, addIndex: number) {
    setItems((prev) => {
      const next = [...prev];
      next[itemIndex] = { ...next[itemIndex], additionals: next[itemIndex].additionals.filter((_, i) => i !== addIndex) };
      return next;
    });
  }

  function addAdditional(itemIndex: number, adicional: Adicional) {
    setItems((prev) => {
      const next = [...prev];
      const item = next[itemIndex];
      if (item.additionals.some((a) => a.name === adicional.name)) return prev;
      next[itemIndex] = { ...item, additionals: [...item.additionals, { name: adicional.name, price: adicional.price }] };
      return next;
    });
    setAddingAdicionalFor(null);
  }

  function getAvailableAdicionales(itemIndex: number): Adicional[] {
    const product = products.find((p) => p.id === items[itemIndex]?.productId);
    if (!product) return [];
    const usedNames = new Set(items[itemIndex].additionals.map((a) => a.name));
    return (product.adicionalIds ?? [])
      .map((id) => adicionalesMap[id])
      .filter(Boolean)
      .filter((a) => a.isActive && !usedNames.has(a.name));
  }

  // El admin puede reprogramar sin las restricciones del cliente (30 min / 7 días / horario):
  // solo se exige una fecha/hora válida. "Comer en el local" nunca es programado.
  const canSchedule = deliveryType !== 'mesa';
  const scheduledDate = canSchedule && isScheduled ? parseScheduleInput(scheduleDate, scheduleTime) : null;

  const canSave = items.length > 0 && customerName.trim() && customerPhone.trim() &&
    (deliveryType !== 'domicilio' || address.trim()) &&
    (!canSchedule || !isScheduled || scheduledDate !== null);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const newItems: OrderItem[] = items.map((item) => {
        const addTotal = item.additionals.reduce((s, a) => s + a.price, 0);
        const unitPrice = item.unitPrice + addTotal;
        return {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: unitPrice * item.quantity,
          additionals: item.additionals,
        };
      });

      await ordersService.updateData(restaurantId, order.id, {
        items: newItems,
        // subtotal = productos · total = productos + domicilio (si deja de ser domicilio, se borra el valor)
        subtotal: total,
        total: total + deliveryFee,
        deliveryFee: deliveryType === 'domicilio' ? order.deliveryFee : undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryType,
        customerAddress: deliveryType === 'domicilio' ? address.trim() : undefined,
        barrio: deliveryType === 'domicilio' && barrio.trim() ? barrio.trim() : undefined,
        // Sin selección se conserva el pago actual; al cambiarlo, `undefined` borra la cuenta anterior
        ...(selectedPayment
          ? {
              paymentMethod: getPaymentLabel(selectedPayment),
              paymentMethodType: selectedPayment.type,
              paymentAccount: selectedPayment.account,
            }
          : {}),
        isScheduled: scheduledDate !== null,
        scheduledFor: scheduledDate ? scheduledDate.toISOString() : undefined,
      });

      onSaved();
      onClose();
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: sg }}
      className="sm:items-center sm:p-4"
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)' }} onClick={onClose} />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        width: '100%', maxWidth: 520, maxHeight: '92dvh',
        background: 'var(--t-surface)', borderRadius: 20, boxShadow: '0 -8px 40px rgba(0,0,0,.18)', overflow: 'hidden',
      }} className="sm:rounded-2xl">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--t-border)', flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: '#FFF3EA', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Save style={{ width: 18, height: 18, color: '#FF6A1A' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t-text-1)' }}>
              Editar pedido <span style={{ fontSize: 12, color: 'var(--t-text-3)', fontWeight: 500 }}>{order.orderNumber}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--t-text-3)', marginTop: 1 }}>Corrige o ajusta cualquier dato</div>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 999, border: 0, background: 'var(--t-surface-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
          >
            <X style={{ width: 15, height: 15, color: 'var(--t-text-2)' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Productos */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShoppingBag style={{ width: 14, height: 14, color: '#FF6A1A' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-1)' }}>Productos</span>
              </div>
              <button
                onClick={() => { setShowAddProduct((v) => !v); setAddingAdicionalFor(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                  padding: '4px 10px', borderRadius: 999, border: 0, cursor: 'pointer', transition: 'all .12s',
                  background: showAddProduct ? 'rgba(255,106,26,.15)' : 'rgba(255,106,26,.08)',
                  color: '#FF6A1A',
                }}
              >
                <Plus style={{ width: 12, height: 12 }} />
                Agregar
              </button>
            </div>

            {showAddProduct && (
              <div style={{ marginBottom: 10, borderRadius: 14, border: '2px dashed #FF6A1A', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 11, color: 'var(--t-text-3)' }}>Elige un producto:</p>

                {/* Category chips */}
                {categories.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none', paddingBottom: 2 }}>
                    <button
                      onClick={() => setFilterCategoryId('')}
                      style={{
                        flexShrink: 0, padding: '4px 10px', borderRadius: 999, fontFamily: sg,
                        fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
                        border: filterCategoryId === '' ? '2px solid #FF6A1A' : '1.5px solid var(--t-border-2)',
                        background: filterCategoryId === '' ? '#FF6A1A' : 'var(--t-surface)',
                        color: filterCategoryId === '' ? '#fff' : 'var(--t-text-2)',
                      }}
                    >
                      Todos
                    </button>
                    {categories.map((cat) => {
                      const active = filterCategoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setFilterCategoryId(active ? '' : cat.id)}
                          style={{
                            flexShrink: 0, padding: '4px 10px', borderRadius: 999, fontFamily: sg,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
                            border: active ? '2px solid #FF6A1A' : '1.5px solid var(--t-border-2)',
                            background: active ? '#FF6A1A' : 'var(--t-surface)',
                            color: active ? '#fff' : 'var(--t-text-2)',
                          }}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {products
                  .filter((p) => p.isActive && p.isAvailable && (!filterCategoryId || p.categoryId === filterCategoryId))
                  .map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 12px', borderRadius: 999, border: '1.5px solid var(--t-border-2)',
                      background: 'var(--t-surface)', cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color .12s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#FF6A1A'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-2)'; }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--t-text-1)' }}>{product.name}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#FF6A1A' }}>{formatCurrency(product.price)}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, index) => {
                const availForItem = getAvailableAdicionales(index);
                return (
                  <div key={index} style={{ borderRadius: 14, border: '1.5px solid var(--t-border-2)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--t-text-1)', marginBottom: 1 }}>{item.productName}</div>
                        <div style={{ fontSize: 12, color: '#FF6A1A', fontWeight: 700 }}>{formatCurrency(item.unitPrice)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => changeQty(index, -1)} style={{ width: 28, height: 28, borderRadius: 999, border: '1.5px solid var(--t-border-2)', background: 'var(--t-surface)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                          <Minus style={{ width: 11, height: 11, color: 'var(--t-text-2)' }} />
                        </button>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--t-text-1)', minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
                        <button onClick={() => changeQty(index, 1)} style={{ width: 28, height: 28, borderRadius: 999, border: 0, background: '#FF6A1A', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                          <Plus style={{ width: 11, height: 11, color: '#fff' }} />
                        </button>
                      </div>
                    </div>

                    {/* Adicionales */}
                    <div style={{ padding: '6px 12px 10px', borderTop: '1px dashed var(--t-border)' }}>
                      {item.additionals.map((a, ai) => (
                        <div key={ai} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--t-text-3)' }}>↳ {a.name} <span style={{ color: 'var(--t-text-4)' }}>+{formatCurrency(a.price)}</span></span>
                          <button onClick={() => removeAdditional(index, ai)} style={{ width: 18, height: 18, borderRadius: 999, border: 0, background: '#fee2e2', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                            <X style={{ width: 10, height: 10, color: '#ef4444' }} />
                          </button>
                        </div>
                      ))}

                      {availForItem.length > 0 && (
                        <button
                          onClick={() => setAddingAdicionalFor(addingAdicionalFor === index ? null : index)}
                          style={{ fontSize: 11, fontWeight: 600, color: '#FF6A1A', background: 'none', border: 0, cursor: 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 3 }}
                        >
                          <Plus style={{ width: 10, height: 10 }} />
                          Adicional
                        </button>
                      )}

                      {addingAdicionalFor === index && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {availForItem.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => addAdditional(index, a)}
                              style={{
                                fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 999,
                                border: '1.5px solid var(--t-border-2)', background: 'var(--t-surface)', color: 'var(--t-text-2)', cursor: 'pointer',
                                transition: 'all .12s',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#FF6A1A'; (e.currentTarget as HTMLElement).style.color = '#FF6A1A'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--t-text-2)'; }}
                            >
                              {a.name} <span style={{ color: 'var(--t-text-4)' }}>+{formatCurrency(a.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--t-text-3)', textAlign: 'center', padding: '16px 0' }}>No quedan productos en el pedido</p>
              )}
            </div>
          </section>

          {/* Datos del cliente */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <User style={{ width: 14, height: 14, color: '#FF6A1A' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-1)' }}>Datos del cliente</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre completo *"
                style={{ width: '100%', borderRadius: 12, border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }} />
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Celular *"
                style={{ width: '100%', borderRadius: 12, border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </section>

          {/* Entrega */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Truck style={{ width: 14, height: 14, color: '#FF6A1A' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-1)' }}>Entrega</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {DELIVERY_TYPES.map((t) => {
                const active = deliveryType === t.value;
                return (
                  <button key={t.value} onClick={() => setDeliveryType(t.value)}
                    style={{
                      padding: '10px 12px', borderRadius: 999, fontFamily: sg, fontWeight: 600, fontSize: 13,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all .12s', border: `2px solid ${active ? '#FF6A1A' : 'var(--t-border-2)'}`,
                      background: 'var(--t-surface)', color: active ? '#FF6A1A' : 'var(--t-text-2)',
                    }}>
                    <span>{t.emoji}</span> {t.label}
                  </button>
                );
              })}
            </div>
            {deliveryType === 'domicilio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección *"
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }} />
                <input type="text" value={barrio} onChange={(e) => setBarrio(e.target.value)} placeholder="Barrio o sector"
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {canSchedule && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--t-text-2)' }}>
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => {
                      setIsScheduled(e.target.checked);
                      if (e.target.checked && !scheduleDate) setScheduleDate(toDateInputValue(new Date()));
                    }}
                    style={{ width: 16, height: 16, accentColor: '#FF6A1A', cursor: 'pointer' }}
                  />
                  <CalendarClock style={{ width: 14, height: 14, color: '#FF6A1A' }} />
                  Pedido programado
                </label>
                {isScheduled && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
                      <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                        style={{ width: '100%', minWidth: 0, borderRadius: 12, border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }} />
                      <input type="time" value={scheduleTime} step={300} onChange={(e) => setScheduleTime(e.target.value)}
                        style={{ width: '100%', minWidth: 0, borderRadius: 12, border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: scheduledDate ? 'var(--t-text-3)' : '#e53e3e' }}>
                      {scheduledDate ? `Para el ${formatScheduledDate(scheduledDate)}` : 'Elige fecha y hora'}
                    </p>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Método de pago */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <CreditCard style={{ width: 14, height: 14, color: '#FF6A1A' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-1)' }}>Método de pago</span>
            </div>
            <PaymentMethodPicker methods={activePaymentMethods} value={paymentMethodId} onChange={setPaymentMethodId} />
            {!selectedPayment && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--t-text-3)' }}>
                Actual: {order.paymentMethod}{order.paymentAccount ? ` — ${order.paymentAccount}` : ''} (ya no está entre los métodos activos)
              </p>
            )}
          </section>

          {error && (
            <p style={{ fontSize: 12, color: '#e53e3e', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: '10px 14px' }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--t-border)', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {deliveryFee > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t-text-3)' }}>
                    <span>Total productos</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t-text-3)' }}>
                    <span>Valor de domicilio</span>
                    <span>{formatCurrency(deliveryFee)}</span>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--t-text-3)', fontWeight: 600 }}>Total actualizado</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: '#FF6A1A' }}>{formatCurrency(total + deliveryFee)}</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ padding: '12px 18px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text-2)', fontFamily: sg, fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: 0, borderRadius: 999, padding: '13px 0', fontFamily: sg, fontWeight: 700, fontSize: 15,
                color: '#fff', cursor: canSave ? 'pointer' : 'not-allowed',
                background: canSave && !saving ? 'linear-gradient(135deg, #FF8A2B, #FF6A1A)' : '#d1c5bd',
                boxShadow: canSave ? '0 8px 20px -8px rgba(255,106,26,.5)' : 'none',
                transition: 'all .15s',
              }}
            >
              {saving ? <Loader2 style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 17, height: 17 }} />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
