'use client';

import { useState } from 'react';
import { Plus, Search, Package, LayoutGrid, List } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { QUERY_KEYS } from '@/constants/query-keys';
import { useToastStore } from '@/store/toast.store';
import { useConfirmStore } from '@/store/confirm.store';
import type { Category, Product } from '@/types';

import { useProducts } from '../../hooks/useProducts';
import { useToggleProductAvailable, useDeleteProduct } from '../../hooks/useProductMutations';
import { productsService } from '../../services/products.service';
import { ProductCard } from '../ProductCard';
import { ProductsTable } from '../ProductsTable';

type View = 'cards' | 'table';

export function ProductsManager() {
  const router = useRouter();
  const { user, can } = useAuth();
  const canUpdate = can('products.update');
  const restaurantId = user?.restaurantId ?? '';
  const queryClient = useQueryClient();

  const { data: products = [], isLoading: loadingProducts } = useProducts(restaurantId);
  const { data: categories = [], isLoading: loadingCategories } = useCategories(restaurantId);

  const toggleAvailable = useToggleProductAvailable(restaurantId);
  const deleteProduct = useDeleteProduct(restaurantId);
  const { showToast } = useToastStore();
  const { showConfirm } = useConfirmStore();

  const [view, setView] = useState<View>(() => {
    if (typeof window === 'undefined') return 'table';
    return (localStorage.getItem('products-view') as View) ?? 'table';
  });
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  function switchView(v: View) {
    setView(v);
    localStorage.setItem('products-view', v);
  }

  const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategory || p.categoryId === filterCategory;
    return matchesSearch && matchesCategory;
  });

  function handleEdit(product: Product) {
    router.push(`/dashboard/productos/${product.id}`);
  }

  function handleAdd() {
    router.push('/dashboard/productos/nuevo');
  }

  async function handleToggleAvailable(id: string, isAvailable: boolean) {
    setTogglingId(id);
    try {
      await toggleAvailable.mutateAsync({ id, isAvailable });
      showToast(isAvailable ? 'Producto marcado como disponible' : 'Producto marcado como no disponible');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!await showConfirm({ message: `¿Eliminar el producto "${name}"? Esta acción no se puede deshacer.` })) return;
    setDeletingId(id);
    try {
      await deleteProduct.mutateAsync(id);
      showToast(`"${name}" eliminado`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const sorted = [...filtered];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const current = sorted[index];
    const target = sorted[targetIndex];
    setMovingId(current.id);
    try {
      await Promise.all([
        productsService.update(restaurantId, current.id, { sortOrder: target.sortOrder }),
        productsService.update(restaurantId, target.id, { sortOrder: current.sortOrder }),
      ]);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products(restaurantId) });
      showToast('Orden actualizado');
    } finally {
      setMovingId(null);
    }
  }

  if (!restaurantId) {
    return <p className="text-sm text-red-600">Tu cuenta no tiene un restaurante asignado.</p>;
  }

  const isLoading = loadingProducts || loadingCategories;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--t-text-1)' }}>Productos</h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--t-text-2)' }}>
            {products.length} producto{products.length !== 1 ? 's' : ''} en el menú
          </p>
        </div>
        {can('products.create') && (
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Button>
        )}
      </div>

      {/* Filtros + toggle de vista */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--t-text-4)' }} />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            style={{
              border: '1px solid var(--t-input-border)',
              background: 'var(--t-input-bg)',
              color: 'var(--t-text-1)',
            }}
          />
        </div>
        <Select
          value={filterCategory}
          onChange={setFilterCategory}
          placeholder="Todas las categorías"
          style={{ width: 220, flexShrink: 0 }}
          options={[
            { value: '', label: 'Todas las categorías' },
            ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
          ]}
        />
        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--t-border-2)', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
          {([
            { key: 'table', icon: <List className="h-4 w-4" />, title: 'Vista de tabla' },
            { key: 'cards', icon: <LayoutGrid className="h-4 w-4" />, title: 'Vista de tarjetas' },
          ] as const).map(({ key, icon, title }) => (
            <button
              key={key}
              onClick={() => switchView(key)}
              title={title}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, border: 'none', cursor: 'pointer',
                background: view === key ? '#FF6A1A' : 'var(--t-surface)',
                color: view === key ? '#fff' : 'var(--t-text-3)',
                transition: 'background .15s, color .15s',
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12" style={{ color: 'var(--t-text-4)' }} />
          <h3 className="mt-4 text-lg font-medium" style={{ color: 'var(--t-text-1)' }}>
            {search || filterCategory ? 'Sin resultados' : 'Sin productos'}
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--t-text-2)' }}>
            {search || filterCategory
              ? 'Prueba con otros filtros.'
              : 'Crea los productos de tu menú.'}
          </p>
          {!search && !filterCategory && can('products.create') && (
            <Button onClick={handleAdd} className="mt-4">
              <Plus className="h-4 w-4" />
              Crear primer producto
            </Button>
          )}
        </div>
      ) : view === 'table' ? (
        <ProductsTable
          products={filtered}
          categoryMap={categoryMap}
          onEdit={canUpdate ? handleEdit : undefined}
          onToggleAvailable={can('products.toggle_availability') ? handleToggleAvailable : undefined}
          onDelete={can('products.delete') ? handleDelete : undefined}
          onMoveUp={canUpdate ? (i) => handleMove(i, 'up') : undefined}
          onMoveDown={canUpdate ? (i) => handleMove(i, 'down') : undefined}
          togglingId={togglingId}
          deletingId={deletingId}
          movingId={movingId}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              category={categoryMap.get(product.categoryId)}
              index={index}
              isFirst={index === 0}
              isLast={index === filtered.length - 1}
              onEdit={canUpdate ? handleEdit : undefined}
              onToggleAvailable={can('products.toggle_availability') ? handleToggleAvailable : undefined}
              onDelete={can('products.delete') ? handleDelete : undefined}
              onMoveUp={canUpdate ? (i) => handleMove(i, 'up') : undefined}
              onMoveDown={canUpdate ? (i) => handleMove(i, 'down') : undefined}
              isToggling={togglingId === product.id}
              isDeleting={deletingId === product.id}
              isMoving={movingId === product.id}
            />
          ))}
        </div>
      )}

    </div>
  );
}
