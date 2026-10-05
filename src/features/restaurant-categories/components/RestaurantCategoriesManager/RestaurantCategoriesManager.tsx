'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { ROUTES } from '@/constants/routes';

import {
  useDeleteRestaurantCategory,
  useRestaurantCategories,
  useSetRestaurantCategoryActive,
} from '../../hooks/useRestaurantCategories';

const sg = 'var(--font-sans, sans-serif)';
const ORANGE = '#FF6A1A';

export function RestaurantCategoriesManager() {
  const { data: categories = [], isLoading, error } = useRestaurantCategories();
  const setActive = useSetRestaurantCategoryActive();
  const deleteCategory = useDeleteRestaurantCategory();
  const [actionError, setActionError] = useState('');

  async function run(fn: () => Promise<unknown>) {
    setActionError('');
    try { await fn(); } catch (e) { setActionError(e instanceof Error ? e.message : 'No se pudo completar la acción'); }
  }

  function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar la categoría "${name}"?`)) return;
    return run(() => deleteCategory.mutateAsync(id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: sg }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>Categorías de restaurante</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--t-text-3)' }}>
            Categorías que se muestran en el home y que los restaurantes pueden seleccionar. Máximo 3 por restaurante.
          </p>
        </div>
        <Link
          href={ROUTES.admin.categoriaNueva}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999, background: ORANGE, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
        >
          <Plus size={16} /> Nueva categoría
        </Link>
      </div>

      {actionError && (
        <div role="alert" style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }}>
          {actionError}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 13, color: '#b91c1c' }}>Error al cargar las categorías.</div>}

      {isLoading ? (
        <p style={{ color: 'var(--t-text-3)', fontSize: 14 }}>Cargando categorías…</p>
      ) : categories.length === 0 ? (
        <div style={{ border: '2px dashed var(--t-border)', borderRadius: 16, padding: '40px 20px', textAlign: 'center', background: 'var(--t-surface-2)' }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--t-text-1)', margin: '0 0 6px' }}>Todavía no hay categorías</p>
          <p style={{ fontSize: 13, color: 'var(--t-text-3)', margin: 0 }}>Crea la primera para que los restaurantes puedan seleccionarla.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categories.map((cat) => (
            <div
              key={cat.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--t-surface)', border: `1.5px solid ${cat.isActive ? `${ORANGE}33` : 'var(--t-border-2)'}`,
                borderRadius: 14, padding: '12px 16px', opacity: cat.isActive ? 1 : 0.7,
              }}
            >
              {cat.icon && (
                <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{cat.icon}</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t-text-1)' }}>{cat.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                    background: cat.isActive ? '#d1fae5' : 'var(--t-surface-2)',
                    color: cat.isActive ? '#059669' : 'var(--t-text-3)',
                  }}>
                    {cat.isActive ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--t-text-3)' }}>/{cat.slug} · orden {cat.sortOrder}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Link href={ROUTES.admin.categoria(cat.id)} style={action}><Pencil size={13} /> Editar</Link>
                <button
                  type="button"
                  onClick={() => run(() => setActive.mutateAsync({ id: cat.id, isActive: !cat.isActive }))}
                  style={action}
                >
                  {cat.isActive ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(cat.id, cat.name)}
                  style={action}
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const action: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999,
  border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text-2)',
  fontFamily: sg, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
};
