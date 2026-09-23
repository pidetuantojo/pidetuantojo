'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import type { Restaurant } from '@/types';
import { Modal } from '@/components/ui/Modal';

import { useRestaurants } from '../../hooks/useRestaurants';
import { useToggleRestaurantActive, useDeleteRestaurant } from '../../hooks/useRestaurantMutations';
import { RestaurantList } from '../RestaurantList';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

export function RestaurantsManager() {
  const router = useRouter();
  const { data: restaurants = [], isLoading, error } = useRestaurants();

  const toggleActive = useToggleRestaurantActive();
  const deleteRestaurant = useDeleteRestaurant();

  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = restaurants.filter((r) => r.isActive).length;

  function handleEdit(restaurant: Restaurant) { router.push(`/admin/restaurantes/${restaurant.id}`); }
  function handleAdd() { router.push('/admin/restaurantes/nuevo'); }

  async function handleToggleActive(id: string, isActive: boolean) {
    setTogglingId(id);
    try { await toggleActive.mutateAsync({ id, isActive }); } finally { setTogglingId(null); }
  }

  function handleDelete(id: string, name: string) {
    setDeleteTarget({ id, name });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteTarget(null);
    try { await deleteRestaurant.mutateAsync(deleteTarget.id); } finally { setDeletingId(null); }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        Error al cargar los restaurantes.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: sg }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 28, letterSpacing: '-.02em', color: '#1B1512', margin: '0 0 4px' }}>
            Restaurantes
          </h2>
          <p style={{ fontFamily: sm, fontSize: 12, color: '#8a7f76', margin: 0 }}>
            Gestioná todos los locales de la plataforma
          </p>
        </div>
        <button
          onClick={handleAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, fontFamily: sg,
            fontWeight: 600, fontSize: 14, color: '#fff', border: 0,
            borderRadius: 999, padding: '13px 20px', cursor: 'pointer',
            background: 'linear-gradient(135deg, #FF8A2B, #FF6A1A 55%, #EA3B2E)',
            boxShadow: '0 10px 24px -8px rgba(234,59,46,.5)',
          }}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo restaurante
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'TOTAL', value: String(restaurants.length) },
          { label: 'ACTIVOS', value: String(activeCount), dot: true },
          { label: 'INACTIVOS', value: String(restaurants.length - activeCount) },
        ].map(({ label, value, dot }) => (
          <div
            key={label}
            style={{
              flex: 1, background: '#fff', border: '1px solid #EFE7DF',
              borderRadius: 14, padding: '16px 18px',
            }}
          >
            <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: '#9a8f86', marginBottom: 8 }}>
              {label}
            </div>
            <div style={{ fontWeight: 700, fontSize: 26, color: '#1B1512' }}>
              {value}
              {dot && (
                <span style={{ fontSize: 13, color: '#3F9E6A', fontFamily: sm, marginLeft: 6 }}>●</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 22 }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a89e95" strokeWidth="2" strokeLinecap="round"
          style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre o slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            fontFamily: sg, fontSize: 14, color: '#1B1512', width: '100%',
            border: '1.5px solid #E7DED6', background: '#fff', borderRadius: 13,
            padding: '13px 16px 13px 44px', outline: 'none',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#FF6A1A'; e.target.style.boxShadow = '0 0 0 4px rgba(255,106,26,.12)'; }}
          onBlur={(e) => { e.target.style.borderColor = '#E7DED6'; e.target.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Lista */}
      <RestaurantList
        restaurants={filtered}
        onEdit={handleEdit}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        togglingId={togglingId}
        deletingId={deletingId}
      />

      {/* Modal de confirmación de eliminación */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar restaurante"
        description={`¿Estás seguro que querés eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        size="sm"
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '20px 24px' }}>
          <button
            onClick={() => setDeleteTarget(null)}
            style={{
              fontFamily: sg, fontWeight: 600, fontSize: 14,
              color: '#6b7280', background: '#f3f4f6',
              border: 0, borderRadius: 999, padding: '10px 20px', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={confirmDelete}
            style={{
              fontFamily: sg, fontWeight: 600, fontSize: 14,
              color: '#fff', background: '#EF4444',
              border: 0, borderRadius: 999, padding: '10px 20px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            <Trash2 size={15} />
            Eliminar
          </button>
        </div>
      </Modal>

    </div>
  );
}
