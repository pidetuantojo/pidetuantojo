'use client';

import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { ProductsManager } from '@/features/products/components/ProductsManager';
import { CategoriesManager } from '@/features/categories/components/CategoriesManager';
import { AdicionalesManager } from '@/features/adicionales/components/AdicionalesManager';

const sg = "var(--font-sans, sans-serif)";
const sm = 'var(--font-mono, monospace)';

type Tab = 'productos' | 'categorias' | 'adicionales';

const TABS: { key: Tab; label: string }[] = [
  { key: 'productos',   label: 'Productos' },
  { key: 'categorias',  label: 'Categorías' },
  { key: 'adicionales', label: 'Adicionales' },
];

export default function MenuPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('productos');

  if (!user?.restaurantId) return null;

  return (
    <div style={{ fontFamily: sg }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.1em', color: '#9a8f86', textTransform: 'uppercase', marginBottom: 6 }}>
          Menú
        </div>
        <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: '#1B1512', margin: 0 }}>
          Gestión del menú
        </h1>
        <p style={{ fontSize: 13, color: '#9a8f86', margin: '4px 0 0' }}>
          Administrá los productos, categorías y adicionales de tu carta.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1.5px solid #EFE7DF', marginBottom: 28 }}>
        {TABS.map(({ key, label }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                fontFamily: sg,
                fontSize: 13,
                fontWeight: 600,
                color: active ? '#FF6A1A' : '#9a8f86',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid #FF6A1A' : '2px solid transparent',
                padding: '10px 16px',
                cursor: 'pointer',
                marginBottom: -1.5,
                transition: 'color .15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'productos'   && <ProductsManager />}
      {activeTab === 'categorias'  && <CategoriesManager />}
      {activeTab === 'adicionales' && <AdicionalesManager restaurantId={user.restaurantId} />}
    </div>
  );
}
