'use client';

import { useMemo } from 'react';

import { describePromotion, isScheduleActiveAt, promotionBadge } from '@/features/promotions/engine';
import { useCartStore } from '@/store/cart.store';
import type { Category, Product, Promotion } from '@/types';

const sg = 'var(--font-sans, sans-serif)';
const sm = 'var(--font-mono, monospace)';

interface PromotionsBannerProps {
  promotions: Promotion[];
  products: Product[];
  categories: Category[];
  now: Date;
  primaryColor: string;
  secondaryColor: string;
  // Local cerrado sin pedidos programados: no se ofrece agregar combos
  orderingBlocked?: boolean;
}

/** Carrusel de promociones activas arriba del menú. Los combos se agregan al carrito con un toque. */
export function PromotionsBanner({ promotions, products, categories, now, primaryColor, secondaryColor, orderingBlocked }: PromotionsBannerProps) {
  const addItem = useCartStore((s) => s.addItem);
  const setCartOpen = useCartStore((s) => s.setCartOpen);

  const names = useMemo(() => ({
    products: new Map(products.map((p) => [p.id, p.name])),
    categories: new Map(categories.map((c) => [c.id, c.name])),
  }), [products, categories]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Activas ahora (las de primer pedido también se muestran: invitan a pedir)
  const visible = promotions.filter((p) => p.showInMenu && p.isActive && isScheduleActiveAt(p.schedule, now));
  if (visible.length === 0) return null;

  function addCombo(p: Promotion) {
    const components = (p.comboItems ?? []).map((c) => ({ c, product: productById.get(c.productId) }));
    if (components.some(({ product }) => !product?.isAvailable)) return;
    components.forEach(({ c, product }) => {
      addItem({
        productId: product!.id,
        productName: product!.name,
        ...(product!.image ? { productImage: product!.image } : {}),
        quantity: c.quantity,
        unitPrice: product!.price,
        additionals: [],
        specialInstructions: '',
      });
    });
    setCartOpen(true);
  }

  return (
    <section aria-label="Promociones" style={{ padding: '14px 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', marginBottom: 10, fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: `${secondaryColor}99` }}>
        🔥 Promociones
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 8px', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' as const }}>
        {visible.map((p) => {
          const comboAvailable = p.type === 'combo'
            && (p.comboItems ?? []).length > 0
            && (p.comboItems ?? []).every((c) => productById.get(c.productId)?.isAvailable);
          return (
            <article
              key={p.id}
              style={{
                flex: '0 0 auto', width: visible.length === 1 ? '100%' : 270, maxWidth: '100%', scrollSnapAlign: 'start',
                display: 'flex', gap: 12, alignItems: 'center',
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                color: '#fff', borderRadius: 20, padding: 14,
                boxShadow: '0 10px 24px -14px rgba(0,0,0,.45)', boxSizing: 'border-box',
              }}
            >
              {p.image ? (
                <img src={p.image} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', flexShrink: 0, background: '#fff' }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 14, flexShrink: 0, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontFamily: sg, fontWeight: 900, fontSize: 18 }}>
                  {promotionBadge(p)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, fontFamily: sg }}>
                <span style={{ display: 'inline-block', fontFamily: sm, fontSize: 10, fontWeight: 800, background: 'rgba(255,255,255,.22)', borderRadius: 999, padding: '3px 8px', marginBottom: 4 }}>
                  {p.firstOrderOnly ? 'PRIMER PEDIDO' : promotionBadge(p).toUpperCase()}
                </span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{p.name}</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, opacity: 0.92, lineHeight: 1.35 }}>
                  {p.description || describePromotion(p, names)}
                </p>
                {comboAvailable && !orderingBlocked && (
                  <button
                    type="button"
                    onClick={() => addCombo(p)}
                    style={{ marginTop: 8, border: 0, borderRadius: 999, padding: '6px 12px', background: '#fff', color: secondaryColor, fontFamily: sg, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                  >
                    + Agregar combo
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
