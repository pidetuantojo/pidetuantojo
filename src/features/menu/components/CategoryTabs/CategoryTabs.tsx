'use client';

import type { Category } from '@/types';

interface CategoryTabsProps {
  categories: Category[];
  activeId: string;
  primaryColor: string;
  secondaryColor: string;
  onSelect: (id: string) => void;
}

const sg = "var(--font-sans, sans-serif)";

export function CategoryTabs({ categories, activeId, primaryColor, secondaryColor, onSelect }: CategoryTabsProps) {
  return (
    <div style={{ display: 'flex', gap: 9, overflowX: 'auto', padding: '20px 16px 6px', scrollbarWidth: 'none' }}>
      {categories.map((cat) => {
        const isActive = activeId === cat.id;
        return (
          <button
            key={cat.id}
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
    </div>
  );
}
