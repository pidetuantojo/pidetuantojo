'use client';

import { useEffect, useRef, useState } from 'react';

import { formatCurrency } from '@/lib/utils';
import type { CartItem } from '@/store/cart.store';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

interface OrderSummaryBarProps {
  items: CartItem[];
  count: number;
  total: number;
  primaryColor: string;
  secondaryColor: string;
  onOpen: () => void;
  onRemove: (cartId: string) => void;
  // mobile: barra fija abajo dentro del contenedor de 480px · desktop: panel flotante abajo a la derecha
  variant: 'mobile' | 'desktop';
}

/**
 * Resumen del pedido + botón "Completar pedido".
 * Renderiza un espaciador con la altura real de la barra para que no tape el final de la página.
 */
export function OrderSummaryBar({ items, count, total, primaryColor: pri, secondaryColor: sec, onOpen, onRemove, variant }: OrderSummaryBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isDesktop = variant === 'desktop';

  const position: React.CSSProperties = isDesktop
    ? { right: 32, bottom: 24, width: 380 }
    : {
        left: 'max(0px, calc(50vw - 240px))',
        right: 'max(0px, calc(50vw - 240px))',
        bottom: 0,
        padding: '0 12px max(12px, env(safe-area-inset-bottom))',
      };

  return (
    <>
      {/* Espaciador: en desktop el panel va al costado, solo hace falta liberar el pie de página */}
      <div aria-hidden="true" style={{ height: isDesktop ? 24 : barHeight + 8 }} />

      <div ref={barRef} style={{ position: 'fixed', zIndex: 30, ...position }}>
        <div style={{ borderRadius: 16, boxShadow: '0 12px 30px -12px rgba(0,0,0,.45)', overflow: 'hidden', border: isDesktop ? `1px solid ${sec}18` : 'none' }}>
          {isDesktop && (
            <div style={{ background: '#fff', padding: '12px 16px 0', fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9a8f86' }}>
              Tu pedido
            </div>
          )}

          {/* Lista con alto máximo: con muchos productos hace scroll en vez de tapar el menú */}
          <ul style={{ listStyle: 'none', margin: 0, background: '#fff', padding: '6px 8px 6px 14px', maxHeight: isDesktop ? 260 : 132, overflowY: 'auto' }}>
            {items.map((item) => (
              <li key={item.cartId} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
                <span aria-hidden="true" style={{ fontSize: 15 }}>🛍️</span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: sg, fontWeight: 600, fontSize: 13, color: '#1B1512', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.productName}
                </span>
                <span style={{ fontFamily: sm, fontSize: 12, color: '#9a8f86', flexShrink: 0 }}>x{item.quantity}</span>
                <span style={{ fontFamily: sg, fontWeight: 700, fontSize: 13, color: pri, flexShrink: 0 }}>{formatCurrency(item.subtotal)}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${item.productName}`}
                  onClick={(e) => { e.stopPropagation(); onRemove(item.cartId); }}
                  style={{ width: 32, height: 32, flexShrink: 0, background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#b8b0a8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onOpen}
            style={{ width: '100%', border: 'none', background: sec, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', fontFamily: sg }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <span style={{ minWidth: 26, height: 26, padding: '0 7px', borderRadius: 8, background: pri, color: '#fff', fontWeight: 700, fontSize: 13, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{count}</span>
              <span style={{ fontWeight: 600, fontSize: 15, color: '#fff', whiteSpace: 'nowrap' }}>Completar pedido</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0 }}>
              {formatCurrency(total)}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
