'use client';

import Image from 'next/image';
import { Package } from 'lucide-react';

import { useCartStore } from '@/store/cart.store';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types';

interface MenuProductCardProps {
  product: Product;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  categoryName?: string;
  restaurantClosed?: boolean;
  onSelect: (product: Product) => void;
}

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
const sm = "var(--font-space-mono, monospace)";

export function MenuProductCard({ product, primaryColor, secondaryColor, accentColor, categoryName, restaurantClosed, onSelect }: MenuProductCardProps) {
  const { name, description, price, image, tag, isAvailable } = product;
  const canAdd = isAvailable && !restaurantClosed;

  const items = useCartStore((s) => s.items);
  const qtyInCart = items
    .filter((i) => i.productId === product.id)
    .reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div
      onClick={() => canAdd && onSelect(product)}
      style={{
        background: '#fff',
        borderRadius: 22,
        overflow: 'hidden',
        boxShadow: '0 8px 26px -18px rgba(0,0,0,.3)',
        opacity: isAvailable ? 1 : 0.7,
        cursor: canAdd ? 'pointer' : 'default',
      }}
    >
      {/* imagen */}
      <div style={{ position: 'relative', height: 200, background: '#fff' }}>
        {image ? (
          <Image src={image} alt={name} fill style={{ objectFit: 'contain', padding: '8px' }} sizes="(max-width: 600px) 100vw, 50vw" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#f5f0eb' }}>
            <Package style={{ width: 40, height: 40, color: '#d0c8be' }} />
          </div>
        )}

        {/* category badge */}
        {categoryName && (
          <span style={{
            position: 'absolute', top: 12, left: 12,
            fontFamily: sg, fontWeight: 600, fontSize: 12, color: '#fff',
            background: primaryColor, borderRadius: 999, padding: '6px 13px',
            boxShadow: '0 4px 10px rgba(0,0,0,.18)',
          }}>
            {categoryName}
          </span>
        )}

        {/* qty in cart badge */}
        {qtyInCart > 0 && (
          <span style={{
            position: 'absolute', top: 12, left: categoryName ? 'auto' : 12,
            right: categoryName ? 'auto' : 'auto',
          }} />
        )}

        {/* price badge */}
        <span style={{
          position: 'absolute', top: 12, right: 12,
          fontFamily: sg, fontWeight: 700, fontSize: 15, color: primaryColor,
          background: '#fff', borderRadius: 999, padding: '7px 14px',
          boxShadow: '0 4px 10px rgba(0,0,0,.14)',
        }}>
          {formatCurrency(price)}
          {qtyInCart > 0 && (
            <span style={{ marginLeft: 6, background: primaryColor, color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>
              {qtyInCart}
            </span>
          )}
        </span>

        {/* agotado overlay */}
        {!isAvailable && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center' }}>
            <span style={{ background: 'rgba(255,255,255,.9)', borderRadius: 10, padding: '6px 14px', fontFamily: sg, fontWeight: 700, fontSize: 14, color: '#333' }}>
              Agotado
            </span>
          </div>
        )}
      </div>

      {/* info */}
      <div style={{ padding: '16px 18px 18px' }}>
        {tag && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontFamily: sm, fontSize: 10, fontWeight: 700,
            color: primaryColor, background: accentColor,
            borderRadius: 999, padding: '5px 11px', marginBottom: 10,
          }}>
            ★ {tag.toUpperCase()}
          </span>
        )}

        <h3 style={{ fontFamily: sg, fontWeight: 700, fontSize: 19, letterSpacing: '-.01em', color: secondaryColor, margin: '0 0 6px' }}>
          {name}
        </h3>

        {description && (
          <p style={{ fontFamily: sg, fontSize: 13, lineHeight: 1.5, color: '#8a8177', margin: '0 0 16px' }}>
            {description}
          </p>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); if (canAdd) onSelect(product); }}
          disabled={!canAdd}
          style={{
            width: '100%', border: 0, borderRadius: 999, padding: 15,
            cursor: canAdd ? 'pointer' : 'not-allowed',
            fontFamily: sg, fontWeight: 700, fontSize: 15,
            color: canAdd ? '#fff' : '#a09890',
            background: canAdd ? primaryColor : '#e8e3dd',
            boxShadow: canAdd ? `0 10px 22px -10px ${primaryColor}` : 'none',
            opacity: isAvailable ? 1 : 0.5,
          }}
        >
          {restaurantClosed ? 'Restaurante cerrado' : '+ Añadir al pedido'}
        </button>
      </div>
    </div>
  );
}
