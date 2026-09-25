'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '@/features/auth';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { useProducts } from '@/features/products/hooks/useProducts';
import { useAdicionales } from '@/features/adicionales/hooks/useAdicionales';
import { ProductForm } from '@/features/products/components/ProductForm';

export default function NuevoProductoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  const { data: categories = [], isLoading: loadingCats } = useCategories(restaurantId);
  const { data: products = [], isLoading: loadingProducts } = useProducts(restaurantId);
  const { data: adicionales = [], isLoading: loadingAdicionales } = useAdicionales(restaurantId);

  const isLoading = loadingCats || loadingProducts || loadingAdicionales;

  function goBack() {
    router.push('/dashboard/productos');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text-3)] transition-colors hover:bg-[var(--t-surface-2)] hover:text-[var(--t-text-1)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--t-text-1)]">Nuevo producto</h1>
          <p className="text-sm text-[var(--t-text-3)]">Completa los datos del producto</p>
        </div>
      </div>

      {/* Form */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <span className="h-7 w-7 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--t-border-2)] bg-[var(--t-surface)]">
          <ProductForm
            restaurantId={restaurantId}
            categories={categories}
            adicionales={adicionales}
            defaultSortOrder={products.length + 1}
            onSuccess={goBack}
            onCancel={goBack}
          />
        </div>
      )}
    </div>
  );
}
