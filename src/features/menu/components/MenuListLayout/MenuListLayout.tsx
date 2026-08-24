'use client';

import { useState } from 'react';
import Image from 'next/image';

import { formatCurrency } from '@/lib/utils';
import type { Category, Product } from '@/types';

interface MenuListLayoutProps {
  categories: Category[];
  products: Product[];
  primaryColor: string;
  secondaryColor: string;
  onSelect: (product: Product) => void;
}

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";

export function MenuListLayout({ categories, products, primaryColor, secondaryColor, onSelect }: MenuListLayoutProps) {
  // All categories open by default
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(categories.slice(0, 1).map((c) => c.id)));

  function toggleCategory(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 16px 24px' }}>
      {categories.map((cat) => {
        const catProducts = products.filter((p) => p.categoryId === cat.id && p.isActive);
        if (catProducts.length === 0) return null;

        const isOpen = openIds.has(cat.id);

        return (
          <div key={cat.id} style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 24px -18px rgba(0,0,0,.3)' }}>
            {/* Category header */}
            <button
              onClick={() => toggleCategory(cat.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: 15, cursor: 'pointer', background: secondaryColor,
                border: 0, appearance: 'none',
              }}
            >
              <span style={{
                fontFamily: sg, fontWeight: 700, fontSize: 16,
                letterSpacing: '.02em', textTransform: 'uppercase',
                color: '#fff',
              }}>
                {cat.name}
              </span>
              <span style={{ display: 'inline-flex', transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </span>
            </button>

            {/* Products */}
            {isOpen && (
              <div style={{ background: '#efeae4', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {catProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => product.isAvailable && onSelect(product)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13,
                      background: '#fff', borderRadius: 16, padding: '12px 14px',
                      boxShadow: '0 4px 14px -10px rgba(0,0,0,.3)',
                      opacity: product.isAvailable ? 1 : 0.55,
                      cursor: product.isAvailable ? 'pointer' : 'default',
                    }}
                  >
                    {/* Image */}
                    <div style={{ width: 76, height: 76, borderRadius: 13, overflow: 'hidden', flexShrink: 0, border: '1px solid #f0ece7', background: '#fff', position: 'relative' }}>
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          style={{ objectFit: 'contain', padding: 6 }}
                          sizes="76px"
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: `${primaryColor}18` }}>
                          <span style={{ fontFamily: sg, fontWeight: 800, fontSize: 20, color: primaryColor }}>
                            {product.name[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontFamily: sg, fontWeight: 700, fontSize: 15, lineHeight: 1.2, color: secondaryColor, margin: '0 0 4px' }}>
                        {product.name}
                      </h4>
                      {product.description && (
                        <p style={{
                          fontFamily: sg, fontSize: 11.5, lineHeight: 1.4, color: '#9a9088',
                          margin: '0 0 7px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        } as React.CSSProperties}>
                          {product.description}
                        </p>
                      )}
                      <span style={{ fontFamily: sg, fontWeight: 700, fontSize: 15, color: secondaryColor }}>
                        {formatCurrency(product.price)}
                      </span>
                    </div>

                    {/* Add button */}
                    <button
                      aria-label="Añadir al pedido"
                      onClick={(e) => { e.stopPropagation(); product.isAvailable && onSelect(product); }}
                      disabled={!product.isAvailable}
                      style={{
                        width: 40, height: 40, flexShrink: 0,
                        border: 0, borderRadius: 999, cursor: product.isAvailable ? 'pointer' : 'not-allowed',
                        background: primaryColor,
                        display: 'grid', placeItems: 'center',
                        boxShadow: `0 8px 16px -8px ${primaryColor}`,
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
