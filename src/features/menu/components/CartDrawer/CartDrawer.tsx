'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { X, Minus, Plus, Trash2, Truck, Store, User, UtensilsCrossed, CalendarClock, CheckCircle2 } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import { cartItemCount, useCartStore } from '@/store/cart.store';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../../helpers/whatsapp.helpers';
import type { DeliveryType, PaymentMethod } from '../../helpers/whatsapp.helpers';
import { checkCanOrder } from '../../helpers/canOrder.helpers';
import {
  formatScheduledDate,
  getScheduleBounds,
  parseScheduleInput,
  toDateInputValue,
  validateScheduledDate,
} from '../../helpers/schedule.helpers';
import { SchedulePicker } from '../SchedulePicker';
import { PaymentMethodIcon } from '@/features/payment-methods/components/PaymentMethodIcon';
import { getPaymentMethodsForDelivery, getPaymentLabel } from '@/features/payment-methods/helpers/payment-methods.helpers';
import { normalizeCouponCode } from '@/features/promotions/engine';
import { useCartPricing } from '@/features/promotions/hooks/useCartPricing';
import { useNow } from '@/features/promotions/hooks/useNow';
import { normalizePhone } from '@/lib/customers/phone';
import type { CheckoutInput, CheckoutResponse, CustomerStatusResponse } from '@/lib/orders/checkout.schema';
import type { DeliveryMethods, DeliveryZone, LoyaltyConfig, Mesa, OpeningHours, PaymentMethodConfig, Product, Promotion } from '@/types';

import { checkoutService, CheckoutRequestError } from '../../services/checkout.service';
import { CartPromotions, CartTotals, type CouponState } from './CartPromotions';
import { getWaTemplates, applyTemplate, DEFAULT_TEMPLATES } from '@/lib/whatsapp/templates';

const sg = "var(--font-sans, sans-serif)";

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
          <span style={{ color: '#9a8f86' }}>Elige tu zona / barrio</span>
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
          Elige tu zona de domicilio
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
  deliveryMethods?: DeliveryMethods;
  openingHours?: OpeningHours;
  // Local cerrado: solo se aceptan pedidos programados
  restaurantClosed?: boolean;
  // Check "Aceptar pedidos programados cuando estés cerrado" del restaurante
  allowScheduledWhenClosed?: boolean;
  paymentMethods?: PaymentMethodConfig[];
  mesas?: Mesa[];
  // Promociones (vista previa; el servidor recalcula todo al confirmar)
  products?: Product[];
  promotions?: Promotion[];
  loyalty?: LoyaltyConfig;
  // El plan incluye cupones (promociones avanzadas)
  couponsEnabled?: boolean;
}

// receivedStatusId: el estado inicial ahora lo asigna el servidor (se mantiene la prop por compatibilidad)
export function CartDrawer({ primaryColor, secondaryColor, deliveryZones, deliveryMode, deliveryMethods, openingHours, restaurantClosed = false, allowScheduledWhenClosed = false, paymentMethods, mesas = [], products = [], promotions = [], loyalty, couponsEnabled = false }: CartDrawerProps) {
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
  const count = useCartStore(cartItemCount);

  const [notaOpen, setNotaOpen] = useState<Record<string, boolean>>({});
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  // Alerta que aparece al elegir un método con cuenta (el número se copia al portapapeles)
  const [copyAlert, setCopyAlert] = useState<{ label: string; account: string; copied: boolean } | null>(null);

  useEffect(() => {
    if (!copyAlert) return;
    const t = setTimeout(() => setCopyAlert(null), 5000);
    return () => clearTimeout(t);
  }, [copyAlert]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [barrio, setBarrio] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [selectedMesaId, setSelectedMesaId] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [waSuccessModal, setWaSuccessModal] = useState<{ orderNumber: string } | null>(null);
  // Promociones
  const [coupon, setCoupon] = useState<CouponState>({ status: 'idle' });
  const [couponPromotion, setCouponPromotion] = useState<Promotion | null>(null);
  const [customerStatus, setCustomerStatus] = useState<CustomerStatusResponse | null>(null);
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const now = useNow();
  const usesPromotions = promotions.length > 0 || couponsEnabled || !!loyalty?.isActive;
  // Promociones que el cliente vio aplicadas: el servidor las respeta unos minutos si vencen justo ahora
  const [seenPromotionIds, setSeenPromotionIds] = useState<Record<string, number>>({});

  // Determine which delivery methods are active (default recoger+domicilio on if not configured)
  // Abierto: cada método decide si permite programar (dashboard → Entrega).
  // Cerrado: solo si el restaurante acepta pedidos programados fuera de horario (dashboard → Horario de atención);
  // en ese caso Recoger y Domicilio se programan obligatoriamente y "Comer en el Local" no aplica.
  const closedOrdersAllowed = restaurantClosed && allowScheduledWhenClosed;
  const recogerScheduled = closedOrdersAllowed || (deliveryMethods?.recoger?.allowScheduled ?? false);
  const domicilioScheduled = closedOrdersAllowed || (deliveryMethods?.domicilio?.allowScheduled ?? false);
  const recogerActive = (deliveryMethods?.recoger?.isActive ?? true) && (!restaurantClosed || closedOrdersAllowed);
  const domicilioActive = (deliveryMethods?.domicilio?.isActive ?? true) && (!restaurantClosed || closedOrdersAllowed);
  const mesaActive = (deliveryMethods?.mesa?.isActive ?? false) && !restaurantClosed;
  const selectedMesa = mesas.find((m) => m.id === selectedMesaId) ?? null;

  const activePaymentMethods = getPaymentMethodsForDelivery(paymentMethods, deliveryMethods, deliveryType as 'recoger' | 'domicilio' | 'mesa' | '');
  const selectedPayment = activePaymentMethods.find((m) => m.id === paymentMethod) ?? null;

  // Programar pedido: solo Domicilio / Recoger y si el restaurante lo habilitó para ese método
  const scheduleAllowed =
    (deliveryType === 'recoger' && recogerScheduled) ||
    (deliveryType === 'domicilio' && domicilioScheduled);
  const scheduleForced = scheduleAllowed && restaurantClosed;
  const wantsSchedule = scheduleAllowed && (isScheduled || restaurantClosed);
  const scheduledDate = wantsSchedule ? parseScheduleInput(scheduleDate, scheduleTime) : null;
  const scheduleError = wantsSchedule ? validateScheduledDate(scheduledDate, openingHours) : null;

  const isZonesMode = deliveryMode === 'zones';
  const selectedZone = isZonesMode
    ? deliveryZones.find((z) => z.id === selectedZoneId) ?? null
    : null;
  const knownDeliveryFee = isZonesMode && deliveryType === 'domicilio' && selectedZone ? selectedZone.price : undefined;

  const pricing = useCartPricing({
    items,
    products,
    promotions,
    now,
    deliveryType,
    deliveryFee: knownDeliveryFee,
    couponPromotion,
    couponCode: coupon.status === 'applied' ? coupon.code : undefined,
    customerStatus,
    loyalty,
    redeemLoyalty,
  });

  // Recordar qué promociones vio aplicadas (para el período de gracia)
  const appliedKey = pricing.applied.map((a) => a.promotionId).join(',');
  useEffect(() => {
    if (!appliedKey) return;
    setSeenPromotionIds((prev) => {
      const next = { ...prev };
      appliedKey.split(',').forEach((id) => { next[id] = Date.now(); });
      return next;
    });
  }, [appliedKey]);

  // Con el celular escrito: ¿cliente nuevo? ¿cuántos sellos de fidelidad lleva?
  const phoneKey = normalizePhone(phone);
  useEffect(() => {
    setCustomerStatus(null);
    setRedeemLoyalty(false);
    if (!usesPromotions || !restaurantId || !phoneKey || phoneKey.length < 10) return;
    let active = true;
    const t = setTimeout(() => {
      checkoutService.customerStatus(restaurantId, phoneKey)
        .then((status) => { if (active) setCustomerStatus(status); })
        .catch(() => { /* sin datos del cliente: la vista previa asume lo básico */ });
    }, 600);
    return () => { active = false; clearTimeout(t); };
  }, [phoneKey, restaurantId, usesPromotions]);

  if (!isCartOpen && !waSuccessModal) return null;

  async function applyCoupon(raw: string) {
    const code = normalizeCouponCode(raw);
    if (!code || !restaurantId) return;
    setCoupon({ status: 'checking' });
    try {
      const promotion = await checkoutService.findCoupon(restaurantId, code);
      setCouponPromotion(promotion);
      setCoupon({ status: 'applied', code });
    } catch (e) {
      setCouponPromotion(null);
      setCoupon({ status: 'error', message: e instanceof Error ? e.message : 'No pudimos validar el cupón.' });
    }
  }

  function removeCoupon() {
    setCoupon({ status: 'idle' });
    setCouponPromotion(null);
  }

  const canOrder = checkCanOrder({
    items,
    name,
    phone,
    deliveryType,
    paymentMethod: selectedPayment ? paymentMethod : '',
    address,
    isZonesMode,
    selectedZoneId,
    barrio,
    selectedMesaId,
    mesaRequired: mesas.length > 0,
    scheduleValid: scheduleError === null,
  });

  function selectDeliveryType(val: DeliveryType) {
    setDeliveryType(val);
    if (val !== 'mesa') setSelectedMesaId('');
    if (restaurantClosed && !scheduleDate) setScheduleDate(toDateInputValue(new Date()));
    // Si el pago seleccionado no está disponible para el nuevo método de entrega, lo reseteamos
    if (paymentMethod) {
      const available = getPaymentMethodsForDelivery(paymentMethods, deliveryMethods, val as 'recoger' | 'domicilio' | 'mesa' | '');
      if (!available.find((m) => m.id === paymentMethod)) setPaymentMethod('');
    }
  }

  function selectPayment(method: PaymentMethodConfig) {
    setPaymentMethod(method.id);
    const account = method.account;
    if (!account) { setCopyAlert(null); return; }
    const label = getPaymentLabel(method);
    const show = (copied: boolean) => setCopyAlert({ label, account, copied });
    if (!navigator.clipboard?.writeText) { show(false); return; }
    navigator.clipboard.writeText(account).then(() => show(true), () => show(false));
  }

  function toggleScheduled(checked: boolean) {
    setIsScheduled(checked);
    if (checked && !scheduleDate) setScheduleDate(toDateInputValue(new Date()));
  }

  async function handleConfirm() {
    setSubmitted(true);
    setSubmitError('');
    if (!canOrder || !restaurantId || isLoading || !deliveryType) return;

    setIsLoading(true);

    const effectiveBarrio = isZonesMode && selectedZone ? selectedZone.name : barrio;
    const couponCode = coupon.status === 'applied' ? coupon.code : undefined;

    // El servidor valida productos y precios y calcula promociones y totales
    const input: CheckoutInput = {
      restaurantId,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        additionalIds: item.additionals.filter((a) => a.id).map((a) => a.id!),
        additionalNames: item.additionals.filter((a) => !a.id).map((a) => a.name),
        specialInstructions: item.observacion?.trim() || item.specialInstructions?.trim() || '',
        key: item.cartId,
      })),
      customerName: name,
      customerPhone: phone,
      deliveryType,
      ...(deliveryType === 'domicilio' ? { customerAddress: address } : {}),
      ...(deliveryType === 'domicilio' && !isZonesMode && barrio ? { barrio } : {}),
      ...(deliveryType === 'domicilio' && selectedZone ? { deliveryZoneId: selectedZone.id } : {}),
      ...(deliveryType === 'mesa' && selectedMesa ? { tableId: selectedMesa.id } : {}),
      ...(scheduledDate ? { scheduledFor: scheduledDate.toISOString() } : {}),
      ...(deliveryType === 'domicilio' && location ? { location } : {}),
      paymentMethodId: paymentMethod,
      ...(couponCode ? { couponCode } : {}),
      redeemLoyalty,
      marketingOptIn,
      expectedPromotionIds: Object.keys(seenPromotionIds),
    };

    let created: CheckoutResponse | null = null;
    try {
      created = await checkoutService.submitOrder(input);
    } catch (err) {
      // Error del pedido (agotado, cupón vencido, promo agotada…): se avisa y NO se envía
      if (err instanceof CheckoutRequestError && err.isBusinessError) {
        setSubmitError(err.message);
        setIsLoading(false);
        return;
      }
      // Sin conexión o error del servidor: se envía igual por WhatsApp sin número de orden (como antes)
      console.error('[CartDrawer] Error al guardar el pedido:', err);
    }

    const common = {
      customerName: name,
      customerPhone: phone,
      deliveryType,
      address,
      scheduledLabel: scheduledDate ? formatScheduledDate(scheduledDate) : undefined,
      location: location ?? undefined,
    };
    const message = created
      ? buildWhatsAppMessage(restaurantName, created.items, {
          ...common,
          orderNumber: created.orderNumber,
          subtotal: created.subtotal,
          discount: created.discount,
          promotions: created.appliedPromotions,
          deliveryFee: created.deliveryFee,
          freeDelivery: created.freeDelivery,
          deliveryZoneName: created.deliveryZoneName,
          barrio: created.barrio ?? effectiveBarrio,
          tableName: created.tableName,
          paymentLabel: created.paymentLabel,
          paymentAccount: created.paymentAccount,
        })
      : buildWhatsAppMessage(
          restaurantName,
          [
            ...items.map((item) => {
              const lp = pricing.lines.find((l) => l.key === item.cartId);
              return { ...item, discount: lp?.discount || undefined, promotionName: lp?.promotionNames.join(' + ') };
            }),
            ...pricing.gifts.map((g) => ({ quantity: g.quantity, productName: g.productName, subtotal: 0, additionals: [], isGift: true, promotionName: g.promotionName })),
          ],
          {
            ...common,
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            promotions: pricing.applied,
            deliveryFee: deliveryType === 'domicilio' ? pricing.deliveryFee : undefined,
            freeDelivery: pricing.freeDelivery,
            deliveryZoneName: isZonesMode && deliveryType === 'domicilio' ? selectedZone?.name : undefined,
            barrio: effectiveBarrio,
            tableName: selectedMesa?.name,
            paymentLabel: selectedPayment ? getPaymentLabel(selectedPayment) : '',
            paymentAccount: selectedPayment?.account,
          }
        );
    // Construir URL antes de limpiar estado, navegar al final (igual que antojo-express)
    const whatsappUrl = buildWhatsAppUrl(restaurantPhone, message);

    // Si el pedido fue creado y WA está conectado, enviar notificación automática
    let waConnected = false;
    if (created && restaurantId) {
      try {
        const statusRes = await Promise.race([
          fetch(`/api/whatsapp/connect?restaurantId=${restaurantId}`).then((r) => r.json()),
          new Promise<{ status: string }>((resolve) => setTimeout(() => resolve({ status: 'unknown' }), 2000)),
        ]);
        waConnected = (statusRes as { status: string }).status === 'connected';
      } catch { /* si falla el chequeo, caemos al flujo wa.me */ }
    }

    const savedPhone = phone;
    const savedName = name;
    clearCart();
    setName('');
    setPhone('');
    setAddress('');
    setBarrio('');
    setSelectedZoneId('');
    setSelectedMesaId('');
    setIsScheduled(false);
    setScheduleDate('');
    setScheduleTime('');
    setDeliveryType('');
    setPaymentMethod('');
    setCopyAlert(null);
    setLocation(null);
    setSubmitted(false);
    setIsLoading(false);
    setCoupon({ status: 'idle' });
    setCouponPromotion(null);
    setRedeemLoyalty(false);
    setMarketingOptIn(false);
    setSeenPromotionIds({});

    if (waConnected && created) {
      // Mensaje restaurante → cliente usando plantilla pedido_nuevo
      const notifyData = {
        customerName: savedName,
        customerPhone: savedPhone,
        orderNumber: created.orderNumber,
        total: created.total,
        paymentMethod: created.paymentLabel,
        items: created.items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
      };
      (async () => {
        let waMessage: string;
        try {
          const templates = await getWaTemplates(restaurantId);
          waMessage = applyTemplate(templates.pedido_nuevo, notifyData);
        } catch {
          waMessage = applyTemplate(DEFAULT_TEMPLATES.pedido_nuevo, notifyData);
        }
        fetch('/api/whatsapp/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantId, phone: savedPhone, message: waMessage }),
        }).catch(() => {});
      })();
      setCartOpen(false);
      setWaSuccessModal({ orderNumber: created.orderNumber });
    } else {
      setCartOpen(false);
      // Navegar al final, igual que en antojo-express, para no perder el gesto
      // de usuario en mobile después del await (Safari iOS, WebViews).
      window.location.href = whatsappUrl;
    }
  }

  const err = (val: string) => submitted && val.trim() === '';

  return (
    <>
    {isCartOpen && <div
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
        {/* Alerta: número de cuenta copiado */}
        {copyAlert && (
          <div
            role="alert"
            style={{
              position: 'absolute', left: 12, right: 12, bottom: 16, zIndex: 5,
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46',
              borderRadius: 14, padding: '12px 14px',
              boxShadow: '0 12px 30px -10px rgba(0,0,0,.35)',
              fontSize: 13, lineHeight: 1.5,
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>
                {copyAlert.copied ? 'Número de cuenta copiado' : 'Datos para transferir'}
              </div>
              <div>
                Transfiere a <strong>{copyAlert.label}</strong>:{' '}
                <strong style={{ overflowWrap: 'anywhere' }}>{copyAlert.account}</strong>
              </div>
              <div style={{ color: '#047857' }}>Envía el comprobante por WhatsApp al confirmar.</div>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setCopyAlert(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#065f46', display: 'grid', placeItems: 'center', flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>
        )}

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
                  Agrega productos del menú
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
                          <Image src={item.productImage} alt={item.productName} fill sizes="56px" style={{ objectFit: 'cover' }} />
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
                        {(() => {
                          const lp = pricing.lines.find((l) => l.key === item.cartId);
                          const lineDiscount = lp?.discount ?? 0;
                          return (
                            <>
                              <p style={{ fontWeight: 800, fontSize: 14, color: primaryColor, margin: '4px 0 0', display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                                {lineDiscount > 0 && (
                                  <span style={{ fontWeight: 600, fontSize: 12, color: '#9a8f86', textDecoration: 'line-through' }}>
                                    {formatCurrency(item.subtotal)}
                                  </span>
                                )}
                                {formatCurrency(item.subtotal - lineDiscount)}
                              </p>
                              {lineDiscount > 0 && lp && (
                                <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: '#059669' }}>
                                  🏷 {lp.promotionNames.join(' + ')}
                                </p>
                              )}
                            </>
                          );
                        })()}
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
                {pricing.gifts.map((g) => (
                  <div key={g.promotionId} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ecfdf5', border: '1px dashed #6ee7b7', borderRadius: 16, padding: '10px 12px' }}>
                    <span style={{ fontSize: 22 }}>🎁</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#065f46' }}>{g.quantity > 1 ? `${g.quantity} x ` : ''}{g.productName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#047857' }}>Regalo — {g.promotionName}</p>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#059669' }}>GRATIS</span>
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
                  Selecciona la forma de entrega
                </p>
                {(() => {
                  const activeOptions: { val: DeliveryType; label: string; Icon: React.ElementType }[] = [];
                  if (recogerActive) activeOptions.push({ val: 'recoger', label: 'Recoger en Local', Icon: Store });
                  if (domicilioActive) activeOptions.push({ val: 'domicilio', label: 'Domicilio', Icon: Truck });
                  if (mesaActive) activeOptions.push({ val: 'mesa', label: 'Comer en el Local', Icon: UtensilsCrossed });
                  if (activeOptions.length === 0 && restaurantClosed) {
                    return (
                      <p style={{ margin: 0, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>
                        🌙 Estamos cerrados en este momento y no recibimos pedidos. Vuelve en nuestro horario de atención.
                      </p>
                    );
                  }
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activeOptions.length}, minmax(0, 1fr))`, gap: 8 }}>
                      {activeOptions.map(({ val, label, Icon }) => (
                        <button
                          key={val}
                          type="button"
                          aria-pressed={deliveryType === val}
                          onClick={() => selectDeliveryType(val)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '14px 6px',
                            borderRadius: 14,
                            cursor: 'pointer',
                            fontFamily: sg,
                            fontWeight: 700,
                            fontSize: 12,
                            lineHeight: 1.2,
                            textAlign: 'center',
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
                          <Icon size={22} />
                          {label}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {submitted && deliveryType === '' && (
                  <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>
                    Elige la forma de entrega
                  </p>
                )}

                {/* Mesa selector */}
                {deliveryType === 'mesa' && (
                  <div style={{
                    marginTop: 10,
                    background: '#f9fafb',
                    borderRadius: 14,
                    padding: '12px 14px',
                    border: '1.5px solid #e5e7eb',
                  }}>
                    <p style={{
                      margin: '0 0 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#6b7280',
                      fontFamily: sg,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '.05em',
                    }}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M3 12h18M8 18h8M12 6v12" />
                      </svg>
                      {mesas.length > 0 ? 'Elige tu mesa' : 'Tu mesa'}
                    </p>
                    {mesas.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>
                        🙋 Este local no tiene mesas configuradas. Pregúntale al mesero tu número de mesa o déjalo vacío y continúa con tu pedido.
                      </p>
                    ) : (
                    <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {mesas.map((mesa) => {
                        const sel = selectedMesaId === mesa.id;
                        return (
                          <button
                            key={mesa.id}
                            type="button"
                            onClick={() => setSelectedMesaId(mesa.id)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 10,
                              border: `2px solid ${sel ? secondaryColor : '#e5e7eb'}`,
                              background: sel ? `${secondaryColor}14` : '#fff',
                              color: sel ? secondaryColor : '#374151',
                              fontFamily: sg,
                              fontSize: 13,
                              fontWeight: sel ? 700 : 500,
                              cursor: 'pointer',
                              boxShadow: sel ? `0 0 0 3px ${secondaryColor}22` : 'none',
                              transition: 'all .12s',
                            }}
                          >
                            {mesa.name}
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                      🙋 ¿No sabes en qué mesa estás? Pregúntale al mesero.
                    </p>
                    {submitted && selectedMesaId === '' && (
                      <p style={{ fontSize: 11, color: '#ef4444', margin: '6px 0 0' }}>
                        Elige la mesa en la que estás
                      </p>
                    )}
                    </>
                    )}
                  </div>
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

                {/* Programar pedido */}
                {scheduleAllowed && (() => {
                  const now = new Date();
                  getScheduleBounds(now);
                  const showSchedErr = scheduleError !== null && (submitted || (scheduleDate !== '' && scheduleTime !== ''));
                  return (
                    <div style={{ marginTop: 12, background: '#f9fafb', borderRadius: 14, padding: '12px 14px', border: '1.5px solid #e5e7eb' }}>
                      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#1B1512', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CalendarClock size={15} color={secondaryColor} />
                        ¿Quieres programar tu pedido?
                      </p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: scheduleForced ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                        <input
                          type="checkbox"
                          checked={isScheduled || scheduleForced}
                          disabled={scheduleForced}
                          onChange={(e) => toggleScheduled(e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: secondaryColor, cursor: scheduleForced ? 'default' : 'pointer' }}
                        />
                        Programar para más tarde
                      </label>
                      {scheduleForced && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                          Estamos cerrados en este momento: elige cuándo quieres tu pedido.
                        </p>
                      )}

                      {(isScheduled || scheduleForced) && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <SchedulePicker
                            date={scheduleDate}
                            time={scheduleTime}
                            onDateChange={setScheduleDate}
                            onTimeChange={setScheduleTime}
                            openingHours={openingHours}
                            primaryColor={primaryColor}
                            secondaryColor={secondaryColor}
                          />

                          {showSchedErr && (
                            <p style={{ margin: 0, fontSize: 11, color: '#ef4444' }}>{scheduleError}</p>
                          )}

                          {scheduledDate && !scheduleError && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>
                              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                              <span>
                                Pedido programado para el <strong>{formatScheduledDate(scheduledDate)}</strong>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                  {usesPromotions && (
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#6b7280', lineHeight: 1.45, cursor: 'pointer', marginTop: 2 }}>
                      <input
                        type="checkbox"
                        checked={marketingOptIn}
                        onChange={(e) => setMarketingOptIn(e.target.checked)}
                        style={{ width: 15, height: 15, marginTop: 1, accentColor: secondaryColor, flexShrink: 0 }}
                      />
                      <span>
                        Quiero recibir promociones de {restaurantName || 'este restaurante'} por WhatsApp y autorizo el tratamiento de mis datos (Ley 1581 de 2012). Tu celular también identifica tus promociones y sellos.
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Pago */}
              <div>
                <p style={{ fontWeight: 800, fontSize: 14, color: '#1B1512', margin: '0 0 10px' }}>
                  Método de Pago
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {activePaymentMethods.map((method) => {
                    const sel = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => selectPayment(method)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          padding: '12px 6px',
                          borderRadius: 14,
                          cursor: 'pointer',
                          fontFamily: sg,
                          textAlign: 'center',
                          minWidth: 0,
                          border: '2px solid',
                          borderColor: sel
                            ? secondaryColor
                            : submitted && paymentMethod === ''
                              ? '#fca5a5'
                              : '#e5e7eb',
                          background: sel ? `${secondaryColor}12` : '#fff',
                          color: sel ? secondaryColor : '#6b7280',
                        }}
                      >
                        <PaymentMethodIcon type={method.type} size={22} />
                        <span style={{ fontWeight: 800, fontSize: 13, color: sel ? secondaryColor : '#1B1512', lineHeight: 1.2 }}>
                          {getPaymentLabel(method)}
                        </span>
                        {method.account && (
                          <span style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.2, maxWidth: '100%', overflowWrap: 'anywhere' }}>
                            {method.account}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {submitted && paymentMethod === '' && (
                  <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>
                    Elige un método de pago
                  </p>
                )}
              </div>

              {/* Promociones: te faltan $X, cupón y fidelidad */}
              {usesPromotions && (
                <CartPromotions
                  pricing={pricing}
                  secondaryColor={secondaryColor}
                  couponsEnabled={couponsEnabled}
                  coupon={coupon}
                  onApplyCoupon={applyCoupon}
                  onRemoveCoupon={removeCoupon}
                  loyalty={loyalty}
                  loyaltyStatus={customerStatus?.loyalty ?? undefined}
                  redeemLoyalty={redeemLoyalty}
                  onToggleRedeem={setRedeemLoyalty}
                />
              )}

              {/* Totales (vista previa: el servidor recalcula al confirmar) */}
              <CartTotals
                pricing={pricing}
                secondaryColor={secondaryColor}
                deliveryType={deliveryType}
                isZonesMode={isZonesMode}
                zoneName={selectedZone?.name}
              />

              {submitError && (
                <div role="alert" style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 12px', lineHeight: 1.5 }}>
                  {submitError}
                </div>
              )}

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
    </div>}

    {/* Modal: pedido creado + WA enviado automáticamente */}
    {waSuccessModal && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'rgba(0,0,0,.5)',
          backdropFilter: 'blur(4px)',
          fontFamily: sg,
        }}
        onClick={() => setWaSuccessModal(null)}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: '32px 28px',
            maxWidth: 360,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,.25)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1B1512', margin: '0 0 6px' }}>
            ¡Pedido creado!
          </h2>
          {waSuccessModal.orderNumber && (
            <p style={{ fontSize: 14, color: '#9a8f86', margin: '0 0 20px' }}>
              Pedido <span style={{ fontWeight: 700, color: '#1B1512' }}>{waSuccessModal.orderNumber}</span>
            </p>
          )}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#15803d' }}>
                Resumen enviado por WhatsApp
              </span>
            </div>
          </div>
          <button
            onClick={() => setWaSuccessModal(null)}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 14,
              border: 'none',
              background: primaryColor,
              color: '#fff',
              fontFamily: sg,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ¡Genial!
          </button>
        </div>
      </div>
    )}
    </>
  );
}
