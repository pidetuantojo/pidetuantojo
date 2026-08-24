'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Minus, Plus, Trash2, Truck, Store, CreditCard, Banknote, User } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import { cartItemCount, cartTotal, useCartStore } from '@/store/cart.store';
import { buildWhatsAppMessage, openWhatsApp } from '../../helpers/whatsapp.helpers';
import type { DeliveryType, PaymentMethod } from '../../helpers/whatsapp.helpers';
import { ordersService } from '@/features/orders/services/orders.service';
import type { DeliveryZone } from '@/types';

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";

interface ZoneDropdownProps {
  zones: DeliveryZone[];
  value: string;
  onChange: (id: string) => void;
  hasError: boolean;
  secondaryColor: string;
}

function ZoneDropdown({ zones, value, onChange, hasError, secondaryColor }: ZoneDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = zones.find((z) => z.id === value) ?? null;
  const filtered = zones.filter((z) => z.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderRadius: 12,
          border: `1.5px solid ${hasError ? '#fca5a5' : open ? secondaryColor : '#e5e7eb'}`,
          background: hasError ? '#fef2f2' : '#fff',
          fontFamily: sg,
          fontSize: 13,
          cursor: 'pointer',
          transition: 'border-color .12s',
          boxSizing: 'border-box',
        }}
      >
        {selected ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
            <span style={{ fontWeight: 700, color: '#1B1512' }}>{selected.name}</span>
            <span style={{ fontWeight: 800, color: secondaryColor }}>{formatCurrency(selected.price)}</span>
          </span>
        ) : (
          <span style={{ color: '#9a8f86' }}>Elegí tu zona / barrio</span>
        )}
        <svg
          viewBox="0 0 24 24" width="16" height="16" fill="none"
          stroke="#9a8f86" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: '#fff',
            border: `1.5px solid #e5e7eb`,
            borderRadius: 14,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            zIndex: 50,
          }}
        >
          {/* Buscador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#9a8f86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar barrio..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, fontFamily: sg, color: '#1B1512', background: 'transparent' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9a8f86', display: 'grid', placeItems: 'center' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: '6px' }}>
            {filtered.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: '#9a8f86', fontFamily: sg }}>Sin resultados</p>
            ) : filtered.map((zone) => {
              const sel = zone.id === value;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => { onChange(zone.id); setOpen(false); setSearch(''); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: sel ? `${secondaryColor}14` : 'transparent',
                    cursor: 'pointer',
                    fontFamily: sg,
                    transition: 'background .1s',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? secondaryColor : '#1B1512' }}>
                    {zone.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sel ? secondaryColor : '#6b7280' }}>
                    {formatCurrency(zone.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasError && (
        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
          Elegí tu zona de domicilio
        </p>
      )}
    </div>
  );
}

interface CartDrawerProps {
  primaryColor: string;
  secondaryColor: string;
  receivedStatusId: string;
  deliveryZones: DeliveryZone[];
  deliveryMode: 'manual' | 'zones';
}

export function CartDrawer({ primaryColor, secondaryColor, receivedStatusId, deliveryZones, deliveryMode }: CartDrawerProps) {
  const items = useCartStore((s) => s.items);
  const isCartOpen = useCartStore((s) => s.isCartOpen);
  const setCartOpen = useCartStore((s) => s.setCartOpen);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const updateObservacion = useCartStore((s) => s.updateObservacion);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const restaurantId = useCartStore((s) => s.restaurantId);
  const restaurantPhone = useCartStore((s) => s.restaurantPhone);
  const restaurantName = useCartStore((s) => s.restaurantName);
  const total = useCartStore(cartTotal);
  const count = useCartStore(cartItemCount);

  const [notaOpen, setNotaOpen] = useState<Record<string, boolean>>({});
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [barrio, setBarrio] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isZonesMode = deliveryMode === 'zones';
  const selectedZone = isZonesMode
    ? deliveryZones.find((z) => z.id === selectedZoneId) ?? null
    : null;
  const deliveryFee = selectedZone?.price ?? 0;
  const orderTotal = isZonesMode && deliveryType === 'domicilio' ? total + deliveryFee : total;

  if (!isCartOpen) return null;

  const canOrder =
    items.length > 0 &&
    name.trim() !== '' &&
    phone.trim() !== '' &&
    deliveryType !== '' &&
    paymentMethod !== '' &&
    (deliveryType === 'recoger' || (
      address.trim() !== '' &&
      (isZonesMode ? selectedZoneId !== '' : barrio.trim() !== '')
    ));

  async function handleConfirm() {
    setSubmitted(true);
    if (!canOrder || !restaurantId || isLoading) return;

    setIsLoading(true);

    const effectiveBarrio = isZonesMode && selectedZone ? selectedZone.name : barrio;
    const effectiveDeliveryFee =
      isZonesMode && deliveryType === 'domicilio' && selectedZone ? selectedZone.price : undefined;
    const effectiveTotal =
      isZonesMode && deliveryType === 'domicilio' && selectedZone
        ? total + selectedZone.price
        : total;

    // Guardar pedido en Firestore
    try {
      await ordersService.create({
        restaurantId,
        customerName: name,
        customerPhone: phone,
        deliveryType: deliveryType || undefined,
        ...(deliveryType === 'domicilio' && address ? { customerAddress: address } : {}),
        ...(deliveryType === 'domicilio' && effectiveBarrio ? { barrio: effectiveBarrio } : {}),
        ...(effectiveDeliveryFee !== undefined ? { deliveryFee: effectiveDeliveryFee } : {}),
        ...(location ? { location } : {}),
        paymentMethod: paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo',
        isPaid: false,
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          ...(item.productImage ? { productImage: item.productImage } : {}),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          additionals: item.additionals,
          specialInstructions: item.observacion?.trim() || item.specialInstructions?.trim() || '',
        })),
        subtotal: total,
        total: effectiveTotal,
        statusId: receivedStatusId,
      });
    } catch (err) {
      console.error('[CartDrawer] Error al guardar pedido en Firestore:', err);
    }

    const message = buildWhatsAppMessage(restaurantName, items, effectiveTotal, {
      customerName: name,
      customerPhone: phone,
      deliveryType,
      address,
      barrio: effectiveBarrio,
      paymentMethod,
      location: location ?? undefined,
    });
    openWhatsApp(restaurantPhone, message);
    clearCart();
    setName('');
    setPhone('');
    setAddress('');
    setBarrio('');
    setSelectedZoneId('');
    setDeliveryType('');
    setPaymentMethod('');
    setLocation(null);
    setSubmitted(false);
    setIsLoading(false);
    setCartOpen(false);
  }

  const err = (val: string) => submitted && val.trim() === '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.5)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={() => setCartOpen(false)}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,.18)',
          fontFamily: sg,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            borderBottom: '1px solid #f3f4f6',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke={secondaryColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#1B1512' }}>Tu Pedido</span>
            {count > 0 && (
              <span
                style={{
                  background: primaryColor,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  borderRadius: 999,
                  width: 20,
                  height: 20,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {count}
              </span>
            )}
          </div>
          <button
            onClick={() => setCartOpen(false)}
            style={{
              padding: 8,
              borderRadius: 10,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={20} color="#9a8f86" />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {/* Items */}
          <div style={{ padding: '16px 16px 0' }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#1B1512' }}>
                  Tu pedido está vacío
                </p>
                <p style={{ fontSize: 13, color: '#9a8f86', marginTop: 4 }}>
                  Agregá productos del menú
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map((item) => (
                  <div
                    key={item.cartId}
                    style={{ background: '#FBF8F5', borderRadius: 16, padding: 12 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Thumbnail */}
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 12,
                          flexShrink: 0,
                          background: '#f0ece7',
                          overflow: 'hidden',
                          position: 'relative',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            width="22"
                            height="22"
                            fill="none"
                            stroke="#d0c8be"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: '#1B1512', margin: 0 }}>
                          {item.productName}
                        </p>
                        {item.additionals.length > 0 && (
                          <div style={{ marginTop: 2 }}>
                            {item.additionals.map((a, i) => (
                              <p
                                key={i}
                                style={{ fontSize: 11, color: '#9a8f86', margin: '1px 0' }}
                              >
                                + {a.name} (+{formatCurrency(a.price)})
                              </p>
                            ))}
                          </div>
                        )}
                        <p
                          style={{
                            fontWeight: 800,
                            fontSize: 14,
                            color: primaryColor,
                            margin: '4px 0 0',
                          }}
                        >
                          {formatCurrency(item.subtotal)}
                        </p>
                      </div>

                      {/* Qty controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: 'none',
                            background: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(0,0,0,.1)',
                          }}
                        >
                          <Minus size={12} color="#374151" />
                        </button>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 14,
                            color: '#1B1512',
                            minWidth: 16,
                            textAlign: 'center',
                          }}
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: 'none',
                            background: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(0,0,0,.1)',
                          }}
                        >
                          <Plus size={12} color="#374151" />
                        </button>
                        <button
                          onClick={() => removeItem(item.cartId)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: 'none',
                            background: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(0,0,0,.1)',
                            marginLeft: 2,
                          }}
                        >
                          <Trash2 size={12} color="#d1d5db" />
                        </button>
                      </div>
                    </div>

                    {/* Observación */}
                    {notaOpen[item.cartId] ? (
                      <textarea
                        value={item.observacion ?? ''}
                        onChange={(e) => updateObservacion(item.cartId, e.target.value)}
                        placeholder="Ej: sin leche condensada, bajo en azúcar..."
                        rows={2}
                        autoFocus
                        onBlur={() => setNotaOpen((p) => ({ ...p, [item.cartId]: false }))}
                        style={{
                          marginTop: 8,
                          width: '100%',
                          border: '1.5px solid #e5e7eb',
                          borderRadius: 10,
                          padding: '8px 10px',
                          fontSize: 12,
                          fontFamily: sg,
                          color: '#1B1512',
                          resize: 'none',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setNotaOpen((p) => ({ ...p, [item.cartId]: true }))}
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: item.observacion?.trim() ? secondaryColor : '#9a8f86',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: sg,
                          padding: 0,
                          fontWeight: 500,
                        }}
                      >
                        {item.observacion?.trim()
                          ? `📝 ${item.observacion}`
                          : '+ Agregar observación'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout form */}
          {items.length > 0 && (
            <div
              style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              {/* Entrega */}
              <div>
                <p style={{ fontWeight: 800, fontSize: 14, color: '#1B1512', margin: '0 0 10px' }}>
                  ¿Cómo recibís tu pedido?
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(
                    [
                      ['domicilio', 'Domicilio', Truck],
                      ['recoger', 'Recoger', Store],
                    ] as const
                  ).map(([val, label, Icon]) => (
                    <button
                      key={val}
                      onClick={() => setDeliveryType(val)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '12px 8px',
                        borderRadius: 14,
                        cursor: 'pointer',
                        fontFamily: sg,
                        fontWeight: 700,
                        fontSize: 14,
                        border: '2px solid',
                        borderColor:
                          deliveryType === val
                            ? secondaryColor
                            : submitted && deliveryType === ''
                              ? '#fca5a5'
                              : '#e5e7eb',
                        background: deliveryType === val ? `${secondaryColor}12` : '#fff',
                        color: deliveryType === val ? secondaryColor : '#6b7280',
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>
                {submitted && deliveryType === '' && (
                  <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>
                    Elegí cómo recibís tu pedido
                  </p>
                )}

                {deliveryType === 'domicilio' && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Dirección exacta (calle, casa, apto...)"
                      style={{
                        width: '100%',
                        border: `1.5px solid ${err(address) ? '#fca5a5' : '#e5e7eb'}`,
                        borderRadius: 12,
                        padding: '10px 12px',
                        fontSize: 13,
                        fontFamily: sg,
                        color: '#1B1512',
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: err(address) ? '#fef2f2' : '#fff',
                      }}
                    />
                    {isZonesMode ? (
                      <ZoneDropdown
                        zones={deliveryZones}
                        value={selectedZoneId}
                        onChange={setSelectedZoneId}
                        hasError={submitted && deliveryType === 'domicilio' && selectedZoneId === ''}
                        secondaryColor={secondaryColor}
                      />
                    ) : (
                      <input
                        type="text"
                        value={barrio}
                        onChange={(e) => setBarrio(e.target.value)}
                        placeholder="Barrio o sector"
                        style={{
                          width: '100%',
                          border: `1.5px solid ${err(barrio) ? '#fca5a5' : '#e5e7eb'}`,
                          borderRadius: 12,
                          padding: '10px 12px',
                          fontSize: 13,
                          fontFamily: sg,
                          color: '#1B1512',
                          outline: 'none',
                          boxSizing: 'border-box',
                          background: err(barrio) ? '#fef2f2' : '#fff',
                        }}
                      />
                    )}

                    {/* Compartir ubicación */}
                    <button
                      type="button"
                      disabled={locLoading}
                      onClick={() => {
                        if (location) {
                          setLocation(null);
                          return;
                        }
                        if (!navigator.geolocation) return;
                        setLocLoading(true);
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                            setLocLoading(false);
                          },
                          () => setLocLoading(false),
                          { timeout: 8000 }
                        );
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        borderRadius: 12,
                        cursor: locLoading ? 'default' : 'pointer',
                        border: `1.5px solid ${location ? '#10b981' : '#e5e7eb'}`,
                        background: location ? '#f0fdf4' : '#fff',
                        color: location ? '#059669' : '#6b7280',
                        fontFamily: sg,
                        fontSize: 13,
                        fontWeight: 600,
                        width: '100%',
                        justifyContent: 'center',
                        transition: 'all .15s',
                      }}
                    >
                      {locLoading ? (
                        <>
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              border: '2px solid #6b7280',
                              borderTopColor: 'transparent',
                              display: 'block',
                              animation: 'spin 0.7s linear infinite',
                            }}
                          />
                          Obteniendo ubicación...
                        </>
                      ) : location ? (
                        <>
                          <svg
                            viewBox="0 0 24 24"
                            width="15"
                            height="15"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          Ubicación compartida ✓ (toca para quitar)
                        </>
                      ) : (
                        <>
                          <svg
                            viewBox="0 0 24 24"
                            width="15"
                            height="15"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          Compartir mi ubicación{' '}
                          <span style={{ fontSize: 11, fontWeight: 400, color: '#9a8f86' }}>
                            (opcional)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Tus datos */}
              <div>
                <p
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 800,
                    fontSize: 14,
                    color: '#1B1512',
                    margin: '0 0 10px',
                  }}
                >
                  <User size={15} /> Tus datos
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre completo"
                    style={{
                      width: '100%',
                      border: `1.5px solid ${err(name) ? '#fca5a5' : '#e5e7eb'}`,
                      borderRadius: 12,
                      padding: '10px 12px',
                      fontSize: 13,
                      fontFamily: sg,
                      color: '#1B1512',
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: err(name) ? '#fef2f2' : '#fff',
                    }}
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Celular (ej: 300 123 4567)"
                    style={{
                      width: '100%',
                      border: `1.5px solid ${err(phone) ? '#fca5a5' : '#e5e7eb'}`,
                      borderRadius: 12,
                      padding: '10px 12px',
                      fontSize: 13,
                      fontFamily: sg,
                      color: '#1B1512',
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: err(phone) ? '#fef2f2' : '#fff',
                    }}
                  />
                </div>
              </div>

              {/* Pago */}
              <div>
                <p style={{ fontWeight: 800, fontSize: 14, color: '#1B1512', margin: '0 0 10px' }}>
                  ¿Cómo vas a pagar?
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(
                    [
                      ['transferencia', 'Transferencia', CreditCard],
                      ['efectivo', 'Efectivo', Banknote],
                    ] as const
                  ).map(([val, label, Icon]) => (
                    <button
                      key={val}
                      onClick={() => setPaymentMethod(val)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '12px 8px',
                        borderRadius: 14,
                        cursor: 'pointer',
                        fontFamily: sg,
                        fontWeight: 700,
                        fontSize: 14,
                        border: '2px solid',
                        borderColor:
                          paymentMethod === val
                            ? secondaryColor
                            : submitted && paymentMethod === ''
                              ? '#fca5a5'
                              : '#e5e7eb',
                        background: paymentMethod === val ? `${secondaryColor}12` : '#fff',
                        color: paymentMethod === val ? secondaryColor : '#6b7280',
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>
                {submitted && paymentMethod === '' && (
                  <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>
                    Elegí un método de pago
                  </p>
                )}
              </div>

              {/* Subtotal */}
              <div style={{ background: '#f9fafb', borderRadius: 16, padding: '14px 16px' }}>
                {isZonesMode && deliveryType === 'domicilio' && selectedZone ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>Subtotal</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1B1512' }}>{formatCurrency(total)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>Domicilio ({selectedZone.name})</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1B1512' }}>{formatCurrency(selectedZone.price)}</span>
                    </div>
                    <div style={{ height: 1, background: '#e5e7eb' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#1B1512' }}>Total</span>
                      <span style={{ fontWeight: 800, fontSize: 22, color: secondaryColor }}>
                        {formatCurrency(orderTotal)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#1B1512' }}>Subtotal</span>
                      <span style={{ fontWeight: 800, fontSize: 22, color: secondaryColor }}>
                        {formatCurrency(total)}
                      </span>
                    </div>
                    {deliveryType === 'domicilio' && !isZonesMode && (
                      <p style={{ marginTop: 10, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>
                        📦 El valor del domicilio será informado por WhatsApp.
                      </p>
                    )}
                    {deliveryType === 'domicilio' && isZonesMode && !selectedZone && (
                      <p style={{ marginTop: 10, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>
                        📦 Elegí tu zona para ver el costo de domicilio.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Confirmar */}
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 16,
                  border: 'none',
                  background: isLoading ? '#86efac' : '#25D366',
                  color: '#fff',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontFamily: sg,
                  fontWeight: 800,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {isLoading ? 'Enviando...' : 'Confirmar Pedido'}
              </button>

              <button
                onClick={() => {
                  clearCart();
                  setCartOpen(false);
                }}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: sg,
                  fontSize: 13,
                  color: '#9a8f86',
                  padding: '4px 0 16px',
                }}
              >
                Vaciar pedido
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
