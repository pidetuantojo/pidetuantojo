'use client';

import { useState } from 'react';
import { Plus, Search, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { QUERY_KEYS } from '@/constants/query-keys';
import type { Category, Product } from '@/types';

import { useProducts } from '../../hooks/useProducts';
import { useToggleProductAvailable, useDeleteProduct } from '../../hooks/useProductMutations';
import { productsService } from '../../services/products.service';
import { ProductCard } from '../ProductCard';

export function ProductsManager() {
  const router = useRouter();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';
  const queryClient = useQueryClient();

  const { data: products = [], isLoading: loadingProducts } = useProducts(restaurantId);
  const { data: categories = [], isLoading: loadingCategories } = useCategories(restaurantId);

  const toggleAvailable = useToggleProductAvailable(restaurantId);
  const deleteProduct = useDeleteProduct(restaurantId);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

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
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el producto "${name}"?`)) return;
    setDeletingId(id);
    try {
      await deleteProduct.mutateAsync(id);
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
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
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
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12" style={{ color: 'var(--t-text-4)' }} />
          <h3 className="mt-4 text-lg font-medium" style={{ color: 'var(--t-text-1)' }}>
            {search || filterCategory ? 'Sin resultados' : 'Sin productos'}
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--t-text-2)' }}>
            {search || filterCategory
              ? 'Probá con otros filtros.'
              : 'Creá los productos de tu menú.'}
          </p>
          {!search && !filterCategory && (
            <Button onClick={handleAdd} className="mt-4">
              <Plus className="h-4 w-4" />
              Crear primer producto
            </Button>
          )}
        </div>
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
              onEdit={handleEdit}
              onToggleAvailable={handleToggleAvailable}
              onDelete={handleDelete}
              onMoveUp={(i) => handleMove(i, 'up')}
              onMoveDown={(i) => handleMove(i, 'down')}
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
