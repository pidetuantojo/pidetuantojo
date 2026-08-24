'use client';

import { useState, useMemo } from 'react';
import { X, Plus, Minus, Trash2, Search, ShoppingBag } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { Product, Adicional, OrderItem, Additional, Category } from '@/types';

import { ordersService } from '../../services/orders.service';

interface ManualOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  receivedStatusId: string;
  products: Product[];
  adicionales: Adicional[];
  categories: Category[];
}

interface CartLine {
  product: Product;
  quantity: number;
  selectedAdicionales: Adicional[];
}

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";

const PAYMENT_METHODS = [
  { value: 'Efectivo',      emoji: '💵' },
  { value: 'Transferencia', emoji: '🏧' },
];

const DELIVERY_TYPES = [
  { value: 'recoger',   label: 'Recoger',   emoji: '🏪' },
  { value: 'domicilio', label: 'Domicilio',  emoji: '🛵' },
] as const;

export function ManualOrderModal({
  isOpen,
  onClose,
  restaurantId,
  receivedStatusId,
  products,
  adicionales,
  categories,
}: ManualOrderModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'recoger' | 'domicilio'>('recoger');
  const [address, setAddress] = useState('');
  const [barrio, setBarrio] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const activeProducts = useMemo(() => products.filter((p) => p.isActive && p.isAvailable), [products]);

  const filteredProducts = useMemo(() => {
    let result = activeProducts;
    if (selectedCategoryId) result = result.filter((p) => p.categoryId === selectedCategoryId);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return result;
  }, [activeProducts, selectedCategoryId, search]);

  const adicionalesMap = useMemo(
    () => Object.fromEntries(adicionales.map((a) => [a.id, a])),
    [adicionales]
  );

  function getProductAdicionales(product: Product): Adicional[] {
    return (product.adicionalIds ?? [])
      .map((id) => adicionalesMap[id])
      .filter(Boolean)
      .filter((a) => a.isActive);
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.findIndex((l) => l.product.id === product.id);
      if (existing !== -1) return prev.map((l, i) => i === existing ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { product, quantity: 1, selectedAdicionales: [] }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev.map((l) => l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l).filter((l) => l.quantity > 0)
    );
  }

  function toggleAdicional(productId: string, adicional: Adicional) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.product.id !== productId) return l;
        const exists = l.selectedAdicionales.some((a) => a.id === adicional.id);
        return { ...l, selectedAdicionales: exists ? l.selectedAdicionales.filter((a) => a.id !== adicional.id) : [...l.selectedAdicionales, adicional] };
      })
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  function reset() {
    setCart([]); setCustomerName(''); setCustomerPhone('');
    setDeliveryType('recoger'); setAddress(''); setBarrio('');
    setPaymentMethod('Efectivo'); setNotes(''); setSearch('');
    setSelectedCategoryId(''); setError('');
  }

  const subtotal = cart.reduce((sum, l) => {
    const addPrice = l.selectedAdicionales.reduce((s, a) => s + a.price, 0);
    return sum + (l.product.price + addPrice) * l.quantity;
  }, 0);

  async function handleSubmit() {
    if (!customerName.trim()) { setError('El nombre del cliente es requerido'); return; }
    if (!customerPhone.trim()) { setError('El teléfono es requerido'); return; }
    if (cart.length === 0) { setError('Agregá al menos un producto'); return; }
    if (deliveryType === 'domicilio' && !address.trim()) { setError('La dirección es requerida para domicilio'); return; }

    setError('');
    setIsSaving(true);
    try {
      const items: OrderItem[] = cart.map((l) => {
        const addPrice = l.selectedAdicionales.reduce((s, a) => s + a.price, 0);
        const unitPrice = l.product.price;
        const additionals: Additional[] = l.selectedAdicionales.map((a) => ({ name: a.name, price: a.price }));
        return { productId: l.product.id, productName: l.product.name, quantity: l.quantity, unitPrice, subtotal: (unitPrice + addPrice) * l.quantity, additionals };
      });

      await ordersService.create({
        restaurantId,
        statusId: receivedStatusId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryType,
        ...(deliveryType === 'domicilio' && address.trim() ? { customerAddress: address.trim() } : {}),
        ...(deliveryType === 'domicilio' && barrio.trim() ? { barrio: barrio.trim() } : {}),
        paymentMethod,
        isPaid: false,
        items,
        subtotal,
        total: subtotal,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el pedido');
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0' }} className="sm:items-center sm:p-4">
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)' }} onClick={onClose} />
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        width: '100%', maxWidth: 780, maxHeight: '95dvh',
        background: '#fff', borderRadius: 20, boxShadow: '0 -8px 40px rgba(0,0,0,.18)', overflow: 'hidden',
        fontFamily: sg,
      }} className="sm:rounded-2xl sm:max-h-[90vh]">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', borderBottom: '1px solid #F1EAE3', flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: '#FFF3EA', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <ShoppingBag style={{ width: 20, height: 20, color: '#FF6A1A' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#1B1512' }}>Pedido manual</div>
            <div style={{ fontFamily: sg, fontSize: 11, color: '#9a8f86', marginTop: 1 }}>Registrá un pedido directo</div>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: 10, border: 0, background: '#F5F0EB', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
          >
            <X style={{ width: 16, height: 16, color: '#5a5048' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* LEFT — Products */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '46%', borderRight: '1px solid #F1EAE3', overflow: 'hidden' }}>
            {/* Search */}
            <div style={{ padding: '12px 14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F5F0EB', borderRadius: 12, padding: '9px 12px' }}>
                <Search style={{ width: 15, height: 15, color: '#9a8f86', flexShrink: 0 }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  style={{ flex: 1, border: 0, background: 'none', outline: 'none', fontFamily: sg, fontSize: 13, color: '#1B1512' }}
                />
              </div>
            </div>

            {/* Category chips */}
            {categories.length > 0 && (
              <div style={{ display: 'flex', gap: 6, padding: '0 14px 10px', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setSelectedCategoryId('')}
                  style={{
                    flexShrink: 0, padding: '5px 12px', borderRadius: 999, fontFamily: sg,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
                    border: selectedCategoryId === '' ? '2px solid #FF6A1A' : '1.5px solid #EFE7DF',
                    background: selectedCategoryId === '' ? '#FF6A1A' : '#fff',
                    color: selectedCategoryId === '' ? '#fff' : '#5a5048',
                  }}
                >
                  Todos
                </button>
                {categories.map((cat) => {
                  const active = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(active ? '' : cat.id)}
                      style={{
                        flexShrink: 0, padding: '5px 12px', borderRadius: 999, fontFamily: sg,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
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

            {/* Product list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredProducts.map((product) => {
                const line = cart.find((l) => l.product.id === product.id);
                const avail = getProductAdicionales(product);
                return (
                  <div key={product.id} style={{ borderRadius: 14, border: '1.5px solid #EFE7DF', background: '#fff', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1B1512', marginBottom: 1 }}>{product.name}</div>
                        <div style={{ fontSize: 12, color: '#FF6A1A', fontWeight: 700 }}>{formatCurrency(product.price)}</div>
                      </div>
                      {line ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => updateQty(product.id, -1)} style={{ width: 28, height: 28, borderRadius: 999, border: '1.5px solid #EFE7DF', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                            <Minus style={{ width: 12, height: 12, color: '#5a5048' }} />
                          </button>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#1B1512', minWidth: 18, textAlign: 'center' }}>{line.quantity}</span>
                          <button onClick={() => updateQty(product.id, 1)} style={{ width: 28, height: 28, borderRadius: 999, border: 0, background: '#FF6A1A', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 4px 10px -4px rgba(255,106,26,.5)' }}>
                            <Plus style={{ width: 12, height: 12, color: '#fff' }} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(product)} style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: '#FF6A1A', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 10px -4px rgba(255,106,26,.5)' }}>
                          <Plus style={{ width: 16, height: 16, color: '#fff' }} />
                        </button>
                      )}
                    </div>

                    {/* Adicionales toggle (when in cart) */}
                    {line && avail.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {avail.map((a) => {
                          const active = line.selectedAdicionales.some((s) => s.id === a.id);
                          return (
                            <button
                              key={a.id}
                              onClick={() => toggleAdicional(product.id, a)}
                              style={{
                                fontSize: 11, fontFamily: sg, fontWeight: 500,
                                borderRadius: 999, padding: '3px 9px', cursor: 'pointer',
                                border: active ? 0 : '1.5px solid #EFE7DF',
                                background: active ? '#FF6A1A' : '#fff',
                                color: active ? '#fff' : '#5a5048',
                                transition: 'all .12s',
                              }}
                            >
                              +{a.name} {formatCurrency(a.price)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div style={{ textAlign: 'center', paddingTop: 32, fontFamily: sg, fontSize: 13, color: '#9a8f86' }}>Sin productos</div>
              )}
            </div>

            {/* Cart summary */}
            {cart.length > 0 && (
              <div style={{ flexShrink: 0, borderTop: '1px solid #F1EAE3', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 130, overflowY: 'auto' }}>
                {cart.map((line) => {
                  const addPrice = line.selectedAdicionales.reduce((s, a) => s + a.price, 0);
                  return (
                    <div key={line.product.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 12, color: '#1B1512', fontWeight: 500 }}>
                          {line.product.name} <span style={{ color: '#9a8f86' }}>×{line.quantity}</span>
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#FF6A1A' }}>
                          {formatCurrency((line.product.price + addPrice) * line.quantity)}
                        </span>
                        <button onClick={() => removeFromCart(line.product.id)} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center' }}>
                          <Trash2 style={{ width: 13, height: 13, color: '#c9bdb5' }} />
                        </button>
                      </div>
                      {line.selectedAdicionales.length > 0 && (
                        <span style={{ fontSize: 11, color: '#9a8f86' }}>
                          {line.selectedAdicionales.map((a) => `+${a.name}`).join(' · ')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT — Customer + delivery + payment */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* DATOS DEL CLIENTE */}
            <section>
              <div style={{ fontFamily: sg, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#4a4540', marginBottom: 10 }}>
                Datos del cliente
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="text" placeholder="Nombre completo *" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid #EFE7DF', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: '#1B1512', outline: 'none', boxSizing: 'border-box' }} />
                <input type="tel" placeholder="Celular *" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid #EFE7DF', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: '#1B1512', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </section>

            {/* ENTREGA */}
            <section>
              <div style={{ fontFamily: sg, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#4a4540', marginBottom: 10 }}>
                Entrega
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {DELIVERY_TYPES.map((t) => {
                  const active = deliveryType === t.value;
                  return (
                    <button key={t.value} type="button" onClick={() => setDeliveryType(t.value)}
                      style={{ padding: '10px 12px', borderRadius: 12, border: `2px solid ${active ? '#FF6A1A' : '#EFE7DF'}`, background: '#fff', color: active ? '#FF6A1A' : '#5a5048', fontFamily: sg, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .12s' }}>
                      <span>{t.emoji}</span> {t.label}
                    </button>
                  );
                })}
              </div>
              {deliveryType === 'domicilio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <input type="text" placeholder="Dirección *" value={address} onChange={(e) => setAddress(e.target.value)}
                    style={{ width: '100%', borderRadius: 12, border: '1.5px solid #EFE7DF', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: '#1B1512', outline: 'none', boxSizing: 'border-box' }} />
                  <input type="text" placeholder="Barrio o sector" value={barrio} onChange={(e) => setBarrio(e.target.value)}
                    style={{ width: '100%', borderRadius: 12, border: '1.5px solid #EFE7DF', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: '#1B1512', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
            </section>

            {/* MÉTODO DE PAGO */}
            <section>
              <div style={{ fontFamily: sg, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#4a4540', marginBottom: 10 }}>
                Método de pago
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PAYMENT_METHODS.map((m) => {
                  const active = paymentMethod === m.value;
                  return (
                    <button key={m.value} type="button" onClick={() => setPaymentMethod(m.value)}
                      style={{ padding: '10px 12px', borderRadius: 12, border: `2px solid ${active ? '#FF6A1A' : '#EFE7DF'}`, background: '#fff', color: active ? '#FF6A1A' : '#5a5048', fontFamily: sg, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .12s' }}>
                      <span>{m.emoji}</span> {m.value}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* NOTAS */}
            <section>
              <textarea placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                style={{ width: '100%', borderRadius: 12, border: '1.5px solid #EFE7DF', padding: '10px 13px', fontFamily: sg, fontSize: 13, color: '#1B1512', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </section>
          </div>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, borderTop: '1px solid #F1EAE3', background: '#FAFAF9', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && <p style={{ fontFamily: sg, fontSize: 13, color: '#D8412F', textAlign: 'center', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1B1512' }}>Total</span>
            <span style={{ fontWeight: 700, fontSize: 17, color: '#FF6A1A' }}>{formatCurrency(subtotal)}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSaving || cart.length === 0}
            style={{
              width: '100%', border: 0, borderRadius: 14, padding: '14px 0',
              fontFamily: sg, fontWeight: 700, fontSize: 15, color: '#fff',
              background: cart.length === 0 || isSaving ? '#d1c5bd' : 'linear-gradient(135deg, #FF8A2B, #FF6A1A)',
              cursor: cart.length === 0 || isSaving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: cart.length > 0 ? '0 8px 20px -8px rgba(255,106,26,.5)' : 'none',
              transition: 'all .15s',
            }}
          >
            <ShoppingBag style={{ width: 17, height: 17 }} />
            {isSaving ? 'Guardando...' : 'Crear pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
