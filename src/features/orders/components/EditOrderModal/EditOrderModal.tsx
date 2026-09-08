'use client';

import { useState } from 'react';
import { X, Plus, Minus, Save, Loader2, ShoppingBag, Truck, CreditCard, User } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { Order, OrderItem, Product, Adicional, Additional, Category } from '@/types';
import { ordersService } from '../../services/orders.service';

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";

interface EditOrderModalProps {
  order: Order;
  restaurantId: string;
  products: Product[];
  adicionales: Adicional[];
  categories: Category[];
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

const PAYMENT_METHODS = [
  { value: 'Efectivo', emoji: '💵' },
  { value: 'Transferencia', emoji: '🏧' },
];

const DELIVERY_TYPES = [
  { value: 'recoger' as const, label: 'Recoger', emoji: '🏪' },
  { value: 'domicilio' as const, label: 'Domicilio', emoji: '🛵' },
];

export function EditOrderModal({ order, restaurantId, products, adicionales, categories, onClose, onSaved }: EditOrderModalProps) {
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
  const [deliveryType, setDeliveryType] = useState<'recoger' | 'domicilio'>(order.deliveryType ?? 'recoger');
  const [address, setAddress] = useState(order.customerAddress ?? '');
  const [barrio, setBarrio] = useState(order.barrio ?? '');
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod);

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

  const canSave = items.length > 0 && customerName.trim() && customerPhone.trim() &&
    (deliveryType !== 'domicilio' || address.trim());

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
        subtotal: total,
        total,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryType,
        customerAddress: deliveryType === 'domicilio' ? address.trim() : undefined,
        barrio: deliveryType === 'domicilio' && barrio.trim() ? barrio.trim() : undefined,
        paymentMethod,
      });

      onSaved();
      onClose();
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.');
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
        background: '#fff', borderRadius: 20, boxShadow: '0 -8px 40px rgba(0,0,0,.18)', overflow: 'hidden',
      }} className="sm:rounded-2xl">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px', borderBottom: '1px solid #F1EAE3', flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: '#FFF3EA', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Save style={{ width: 18, height: 18, color: '#FF6A1A' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1B1512' }}>
              Editar pedido <span style={{ fontSize: 12, color: '#9a8f86', fontWeight: 500 }}>{order.orderNumber}</span>
            </div>
            <div style={{ fontSize: 11, color: '#9a8f86', marginTop: 1 }}>Corregí o ajustá cualquier dato</div>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 999, border: 0, background: '#F5F0EB', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
          >
            <X style={{ width: 15, height: 15, color: '#5a5048' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Productos */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShoppingBag style={{ width: 14, height: 14, color: '#FF6A1A' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4a4540' }}>Productos</span>
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
                <p style={{ fontSize: 11, color: '#9a8f86' }}>Elegí un producto:</p>

                {/* Category chips */}
                {categories.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none', paddingBottom: 2 }}>
                    <button
                      onClick={() => setFilterCategoryId('')}
                      style={{
                        flexShrink: 0, padding: '4px 10px', borderRadius: 999, fontFamily: sg,
                        fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
                        border: filterCategoryId === '' ? '2px solid #FF6A1A' : '1.5px solid #EFE7DF',
                        background: filterCategoryId === '' ? '#FF6A1A' : '#fff',
                        color: filterCategoryId === '' ? '#fff' : '#5a5048',
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
                            border: active ? '2px solid #FF6A1A' : '1.5px solid #EFE7DF',
                            background: active ? '#FF6A1A' : '#fff',
                            color: active ? '#fff' : '#5a5048',
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
                      padding: '9px 12px', borderRadius: 999, border: '1.5px solid #EFE7DF',
                      background: '#fff', cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color .12s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#FF6A1A'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#EFE7DF'; }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#1B1512' }}>{product.name}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#FF6A1A' }}>{formatCurrency(product.price)}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, index) => {
                const availForItem = getAvailableAdicionales(index);
                return (
                  <div key={index} style={{ borderRadius: 14, border: '1.5px solid #EFE7DF', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1B1512', marginBottom: 1 }}>{item.productName}</div>
                        <div style={{ fontSize: 12, color: '#FF6A1A', fontWeight: 700 }}>{formatCurrency(item.unitPrice)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => changeQty(index, -1)} style={{ width: 28, height: 28, borderRadius: 999, border: '1.5px solid #EFE7DF', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                          <Minus style={{ width: 11, height: 11, color: '#5a5048' }} />
                        </button>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#1B1512', minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
                        <button onClick={() => changeQty(index, 1)} style={{ width: 28, height: 28, borderRadius: 999, border: 0, background: '#FF6A1A', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                          <Plus style={{ width: 11, height: 11, color: '#fff' }} />
                        </button>
                      </div>
                    </div>

                    {/* Adicionales */}
                    <div style={{ padding: '6px 12px 10px', borderTop: '1px dashed #F0EBE6' }}>
                      {item.additionals.map((a, ai) => (
                        <div key={ai} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: '#9a8f86' }}>↳ {a.name} <span style={{ color: '#c9bdb5' }}>+{formatCurrency(a.price)}</span></span>
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
                                border: '1.5px solid #EFE7DF', background: '#fff', color: '#5a5048', cursor: 'pointer',
                                transition: 'all .12s',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#FF6A1A'; (e.currentTarget as HTMLElement).style.color = '#FF6A1A'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#EFE7DF'; (e.currentTarget as HTMLElement).style.color = '#5a5048'; }}
                            >
                              {a.name} <span style={{ color: '#c9bdb5' }}>+{formatCurrency(a.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <p style={{ fontSize: 12, color: '#9a8f86', textAlign: 'center', padding: '16px 0' }}>No quedan productos en el pedido</p>
              )}
            </div>
          </section>

          {/* Datos del cliente */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <User style={{ width: 14, height: 14, color: '#FF6A1A' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4a4540' }}>Datos del cliente</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre completo *"
                style={{ width: '100%', borderRadius: 12, border: '1.5px solid #EFE7DF', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: '#1B1512', outline: 'none', boxSizing: 'border-box' }} />
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Celular *"
                style={{ width: '100%', borderRadius: 12, border: '1.5px solid #EFE7DF', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: '#1B1512', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </section>

          {/* Entrega */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Truck style={{ width: 14, height: 14, color: '#FF6A1A' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4a4540' }}>Entrega</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {DELIVERY_TYPES.map((t) => {
                const active = deliveryType === t.value;
                return (
                  <button key={t.value} onClick={() => setDeliveryType(t.value)}
                    style={{
                      padding: '10px 12px', borderRadius: 999, fontFamily: sg, fontWeight: 600, fontSize: 13,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all .12s', border: `2px solid ${active ? '#FF6A1A' : '#EFE7DF'}`,
                      background: '#fff', color: active ? '#FF6A1A' : '#5a5048',
                    }}>
                    <span>{t.emoji}</span> {t.label}
                  </button>
                );
              })}
            </div>
            {deliveryType === 'domicilio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección *"
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid #EFE7DF', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: '#1B1512', outline: 'none', boxSizing: 'border-box' }} />
                <input type="text" value={barrio} onChange={(e) => setBarrio(e.target.value)} placeholder="Barrio o sector"
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid #EFE7DF', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: '#1B1512', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
          </section>

          {/* Método de pago */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <CreditCard style={{ width: 14, height: 14, color: '#FF6A1A' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4a4540' }}>Método de pago</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PAYMENT_METHODS.map((m) => {
                const active = paymentMethod === m.value;
                return (
                  <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                    style={{
                      padding: '10px 12px', borderRadius: 999, fontFamily: sg, fontWeight: 600, fontSize: 13,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all .12s', border: `2px solid ${active ? '#FF6A1A' : '#EFE7DF'}`,
                      background: '#fff', color: active ? '#FF6A1A' : '#5a5048',
                    }}>
                    <span>{m.emoji}</span> {m.value}
                  </button>
                );
              })}
            </div>
          </section>

          {error && (
            <p style={{ fontSize: 12, color: '#e53e3e', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: '10px 14px' }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, borderTop: '1px solid #F1EAE3', background: '#FAFAF9', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#9a8f86', fontWeight: 600 }}>Total actualizado</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#FF6A1A' }}>{formatCurrency(total)}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ padding: '12px 18px', borderRadius: 999, border: '1.5px solid #E7DED6', background: '#fff', color: '#5a5048', fontFamily: sg, fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
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
