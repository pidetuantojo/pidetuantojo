'use client';

import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '@/features/auth';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { useProduct } from '@/features/products/hooks/useProducts';
import { useAdicionales } from '@/features/adicionales/hooks/useAdicionales';
import { ProductForm } from '@/features/products/components/ProductForm';

export default function EditarProductoPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  const { data: product, isLoading: loadingProduct } = useProduct(restaurantId, id);
  const { data: categories = [], isLoading: loadingCats } = useCategories(restaurantId);
  const { data: adicionales = [], isLoading: loadingAdicionales } = useAdicionales(restaurantId);

  const isLoading = loadingProduct || loadingCats || loadingAdicionales;

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
          <h1 className="text-xl font-bold text-[var(--t-text-1)]">
            {product ? `Editar: ${product.name}` : 'Editar producto'}
          </h1>
          <p className="text-sm text-[var(--t-text-3)]">Modificá los datos del producto</p>
        </div>
      </div>

      {/* Form */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <span className="h-7 w-7 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
        </div>
      ) : !product ? (
        <div className="rounded-2xl border border-[var(--t-border-2)] bg-[var(--t-surface)] p-8 text-center">
          <p className="text-sm text-[var(--t-text-3)]">Producto no encontrado.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--t-border-2)] bg-[var(--t-surface)]">
          <ProductForm
            product={product}
            restaurantId={restaurantId}
            categories={categories}
            adicionales={adicionales}
            onSuccess={goBack}
            onCancel={goBack}
          />
        </div>
      )}
    </div>
  );
}
