'use client';

import { useMemo } from 'react';

import { describePromotion, isScheduleActiveAt, promotionBadge } from '@/features/promotions/engine';
import { useCartStore } from '@/store/cart.store';
import type { Category, Product, Promotion } from '@/types';
import { usePromoCarousel } from './usePromoCarousel';

const sg = 'var(--font-sans, sans-serif)';

function promotionIcon(p: Promotion): string {
  switch (p.type) {
    case 'free_delivery': return '🚚';
    case 'gift':          return '🎁';
    case 'combo':         return '🎁';
    case 'bundle':        return '🛍️';
    case 'item_discount': return '🏷️';
    case 'order_discount':return '💸';
    default:              return '🔥';
  }
}
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

  const visible = promotions.filter((p) => p.showInMenu && p.isActive && isScheduleActiveAt(p.schedule, now));
  const count = visible.length;

  const { scrollRef, activeIndex, goTo, next, prev, handleScroll, pauseTemporarily } = usePromoCarousel(count);

  if (count === 0) return null;

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
    <section
      role="region"
      aria-roledescription="carrusel"
      aria-label="Promociones"
      style={{ padding: '14px 0 4px' }}
    >
      {/* Título + contador */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', marginBottom: 10,
        fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
      }}>
        <span style={{ color: `${secondaryColor}99` }}>🔥 Promociones</span>
        {count > 1 && (
          <span style={{ color: `${secondaryColor}66`, fontWeight: 400 }}>
            {activeIndex + 1} de {count}
          </span>
        )}
      </div>

      {/* Contenedor del carrusel */}
      <div style={{ padding: '0 16px 8px' }}>
        <div>
          {/* Track de slides */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onTouchStart={pauseTemporarily}
            onMouseDown={pauseTemporarily}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
            }}
            tabIndex={count > 1 ? 0 : -1}
            aria-live="off"
            style={{
              display: 'flex',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none' as const,
              outline: 'none',
            }}
          >
            {visible.map((p, i) => {
              const comboAvailable =
                p.type === 'combo' &&
                (p.comboItems ?? []).length > 0 &&
                (p.comboItems ?? []).every((c) => productById.get(c.productId)?.isAvailable);

              return (
                <article
                  key={p.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} de ${count}`}
                  style={{
                    flex: '0 0 100%',
                    scrollSnapAlign: 'start',
                    display: 'flex', gap: 12, alignItems: 'center',
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    color: '#fff', borderRadius: 20, padding: 14,
                    boxShadow: '0 10px 24px -14px rgba(0,0,0,.45)', boxSizing: 'border-box',
                  }}
                >
                  {p.image ? (
                    <img src={p.image} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', flexShrink: 0, background: '#fff' }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 14, flexShrink: 0, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontSize: 28 }}>
                      {promotionIcon(p)}
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

        </div>
      </div>

      {/* Flechas + dots en una sola fila */}
      {count > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button
            type="button"
            onClick={prev}
            aria-label="Promoción anterior"
            style={{
              width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${secondaryColor}33`,
              background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center',
              color: `${secondaryColor}88`, fontFamily: sg, fontSize: 15, lineHeight: 1, padding: 0,
            }}
          >
            ‹
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {visible.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir a la promoción ${i + 1}`}
                aria-current={i === activeIndex ? 'true' : undefined}
                style={{
                  height: 6,
                  width: i === activeIndex ? 18 : 6,
                  borderRadius: 999,
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: i === activeIndex ? secondaryColor : `${secondaryColor}33`,
                  transition: 'width .2s, background .2s',
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={next}
            aria-label="Promoción siguiente"
            style={{
              width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${secondaryColor}33`,
              background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center',
              color: `${secondaryColor}88`, fontFamily: sg, fontSize: 15, lineHeight: 1, padding: 0,
            }}
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}
