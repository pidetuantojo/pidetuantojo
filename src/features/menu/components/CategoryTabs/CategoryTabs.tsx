'use client';

import { useRef, useEffect } from 'react';
import type { Category } from '@/types';

interface CategoryTabsProps {
  categories: Category[];
  activeId: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  onSelect: (id: string) => void;
}

const sg = "var(--font-sans, sans-serif)";

export function CategoryTabs({ categories, activeId, primaryColor, secondaryColor, bgColor, onSelect }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll activo al centro cuando cambia la categoría
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const active = container.querySelector('[data-active="true"]') as HTMLElement | null;
    if (!active) return;
    const { offsetLeft, offsetWidth } = active;
    const { clientWidth } = container;
    container.scrollTo({ left: offsetLeft - clientWidth / 2 + offsetWidth / 2, behavior: 'smooth' });
  }, [activeId]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={scrollRef}
        style={{ display: 'flex', gap: 9, overflowX: 'auto', padding: '20px 16px 6px', scrollbarWidth: 'none' }}
      >
        {categories.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              data-active={isActive}
              onClick={() => onSelect(cat.id)}
              style={{
                flexShrink: 0,
                fontFamily: sg,
                fontWeight: 600,
                fontSize: 13,
                borderRadius: 999,
                padding: '9px 18px',
                border: isActive ? 'none' : '1.5px solid #ece6df',
                background: isActive ? primaryColor : '#fff',
                color: isActive ? '#fff' : secondaryColor,
                cursor: 'pointer',
                transition: 'background .15s, color .15s',
              }}
            >
              {cat.name}
            </button>
          );
        })}
        {/* Spacer para que el último ítem no quede pegado al fade */}
        <div style={{ flexShrink: 0, width: 16 }} />
      </div>

      {/* Fade derecha — indica que hay más categorías */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 48,
        background: `linear-gradient(to right, transparent, ${bgColor})`,
        pointerEvents: 'none',
      }} />
    </div>
  );
}
