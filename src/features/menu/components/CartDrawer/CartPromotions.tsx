'use client';

import { useState } from 'react';
import { Gift, Tag, X } from 'lucide-react';

import { formatMoney, type PricingResult } from '@/features/promotions/engine';
import type { CustomerStatusResponse } from '@/lib/orders/checkout.schema';
import type { LoyaltyConfig } from '@/types';

const sg = 'var(--font-sans, sans-serif)';

export type CouponState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'error'; message: string }
  | { status: 'applied'; code: string };

interface CartPromotionsProps {
  pricing: PricingResult;
  secondaryColor: string;
  // Cupones: solo si el plan del restaurante los incluye
  couponsEnabled: boolean;
  coupon: CouponState;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  loyalty?: LoyaltyConfig;
  loyaltyStatus: CustomerStatusResponse['loyalty'] | undefined;
  redeemLoyalty: boolean;
  onToggleRedeem: (value: boolean) => void;
}

function loyaltyRewardText(config: LoyaltyConfig): string {
  if (config.rewardKind === 'amount') return `${formatMoney(config.rewardValue)} de descuento`;
  if (config.rewardValue >= 100) return `tu pedido gratis${config.maxReward ? ` (hasta ${formatMoney(config.maxReward)})` : ''}`;
  return `${config.rewardValue}% de descuento${config.maxReward ? ` (hasta ${formatMoney(config.maxReward)})` : ''}`;
}

/** "Te faltan $X", cupón y fidelidad dentro del carrito. */
export function CartPromotions({
  pricing, secondaryColor, couponsEnabled, coupon, onApplyCoupon, onRemoveCoupon,
  loyalty, loyaltyStatus, redeemLoyalty, onToggleRedeem,
}: CartPromotionsProps) {
  const [code, setCode] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const couponApplied = coupon.status === 'applied' ? pricing.coupon : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: sg }}>
      {/* Te faltan $X para… */}
      {pricing.nudges.map((n) => (
        <div
          key={n.promotionId}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 12px', lineHeight: 1.45 }}
        >
          <span style={{ fontSize: 16 }}>🔥</span>
          <span>Te faltan <strong>{formatMoney(n.missing)}</strong> para <strong>{n.benefit}</strong></span>
        </div>
      ))}

      {/* Cupón */}
      {couponsEnabled && (
        coupon.status === 'applied' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, borderRadius: 12, padding: '10px 12px', lineHeight: 1.45, ...(couponApplied?.applied ? { color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0' } : { color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a' }) }}>
            <Tag size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <strong>{coupon.code}</strong> — {couponApplied?.message ?? 'Cupón aplicado'}
            </span>
            <button type="button" aria-label="Quitar cupón" onClick={onRemoveCoupon} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2, display: 'grid', placeItems: 'center' }}>
              <X size={15} />
            </button>
          </div>
        ) : couponOpen ? (
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) onApplyCoupon(code); }}
                placeholder="Código del cupón"
                autoFocus
                aria-label="Código del cupón"
                style={{ flex: 1, minWidth: 0, border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '10px 12px', fontSize: 13, fontFamily: sg, color: '#1B1512', outline: 'none', letterSpacing: '.04em' }}
              />
              <button
                type="button"
                disabled={!code.trim() || coupon.status === 'checking'}
                onClick={() => onApplyCoupon(code)}
                style={{ border: 'none', borderRadius: 12, padding: '0 16px', background: secondaryColor, color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: !code.trim() || coupon.status === 'checking' ? 0.6 : 1 }}
              >
                {coupon.status === 'checking' ? '...' : 'Aplicar'}
              </button>
            </div>
            {coupon.status === 'error' && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>{coupon.message}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCouponOpen(true)}
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: sg, fontSize: 13, fontWeight: 600, color: secondaryColor }}
          >
            <Tag size={14} /> ¿Tienes un cupón?
          </button>
        )
      )}

      {/* Fidelidad */}
      {loyalty?.isActive && (
        <div style={{ fontSize: 13, color: '#78350f', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 12px', lineHeight: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
            <Gift size={15} /> Programa de fidelidad
          </div>
          {!loyaltyStatus ? (
            <div>
              Cada {loyalty.ordersRequired} pedidos ganas {loyaltyRewardText(loyalty)}. Escribe tu celular para ver tus sellos.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 3, margin: '6px 0', flexWrap: 'wrap' }} aria-label={`${Math.min(loyaltyStatus.stamps, loyaltyStatus.required)} de ${loyaltyStatus.required} sellos`}>
                {Array.from({ length: loyaltyStatus.required }).map((_, i) => (
                  <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < loyaltyStatus.stamps ? '#f59e0b' : '#fde68a' }} />
                ))}
              </div>
              {loyaltyStatus.rewardAvailable ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={redeemLoyalty}
                    onChange={(e) => onToggleRedeem(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#f59e0b' }}
                  />
                  ¡Ganaste {loyaltyRewardText(loyalty)}! Usarlo en este pedido
                </label>
              ) : (
                <div>
                  Llevas {loyaltyStatus.stamps} de {loyaltyStatus.required}. Te faltan {loyaltyStatus.required - loyaltyStatus.stamps} pedidos para {loyaltyRewardText(loyalty)}.
                </div>
              )}
              <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>Cuentan los pedidos entregados o pagados.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface CartTotalsProps {
  pricing: PricingResult;
  secondaryColor: string;
  deliveryType: string;
  isZonesMode: boolean;
  zoneName?: string;
}

/** Subtotal, descuentos, domicilio y total del carrito (vista previa). */
export function CartTotals({ pricing, secondaryColor, deliveryType, isZonesMode, zoneName }: CartTotalsProps) {
  const isDomicilio = deliveryType === 'domicilio';
  const feeKnown = pricing.deliveryFee !== undefined;
  const feePending = isDomicilio && !feeKnown;
  const discountLines = pricing.applied.filter((a) => a.amount > 0 && a.type !== 'free_delivery');
  const showBreakdown = pricing.discount > 0 || (isDomicilio && feeKnown);
  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const;

  return (
    <div style={{ background: '#f9fafb', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: sg }}>
      {showBreakdown && (
        <div style={row}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{pricing.discount > 0 ? 'Productos' : 'Subtotal'}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1B1512' }}>{formatMoney(pricing.subtotal)}</span>
        </div>
      )}
      {discountLines.map((a) => (
        <div key={a.promotionId} style={row}>
          <span style={{ fontSize: 13, color: '#059669' }}>🏷 {a.type === 'loyalty' ? 'Premio de fidelidad' : a.name}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>−{formatMoney(a.amount)}</span>
        </div>
      ))}
      {isDomicilio && feeKnown && (
        <div style={row}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Domicilio{zoneName ? ` (${zoneName})` : ''}</span>
          {pricing.freeDelivery
            ? <span style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>GRATIS</span>
            : <span style={{ fontSize: 14, fontWeight: 700, color: '#1B1512' }}>{formatMoney(pricing.deliveryFee ?? 0)}</span>}
        </div>
      )}
      {pricing.gifts.map((g) => (
        <div key={g.promotionId} style={{ fontSize: 13, color: '#059669' }}>🎁 Regalo: {g.quantity > 1 ? `${g.quantity} x ` : ''}{g.productName}</div>
      ))}
      {showBreakdown && <div style={{ height: 1, background: '#e5e7eb' }} />}
      <div style={row}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1B1512' }}>{feePending ? 'Subtotal' : 'Total'}</span>
        <span style={{ fontWeight: 800, fontSize: 22, color: secondaryColor }}>{formatMoney(pricing.total)}</span>
      </div>
      {feePending && !isZonesMode && (
        <p style={{ margin: 0, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>
          📦 El valor del domicilio será informado por WhatsApp.
        </p>
      )}
      {feePending && isZonesMode && (
        <p style={{ margin: 0, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>
          📦 Elige tu zona para ver el costo de domicilio.
        </p>
      )}
      {pricing.discount > 0 && (
        <p style={{ margin: 0, fontSize: 11, color: '#9a8f86' }}>El restaurante confirma las promociones al recibir tu pedido.</p>
      )}
    </div>
  );
}
