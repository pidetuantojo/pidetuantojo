'use client';

import Link from 'next/link';

import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { formatCurrency } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';

import { useProductForm } from '../../hooks/useProductForm';
import { useCreateProduct, useUpdateProduct } from '../../hooks/useProductMutations';
import type { ProductFormProps } from './ProductForm.types';

export function ProductForm({
  product,
  restaurantId,
  categories,
  adicionales,
  defaultSortOrder = 1,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const {
    data,
    errors,
    handleChange,
    toggleAdicionalId,
    validate,
    toCreateData,
    toUpdateData,
    isEditing,
  } = useProductForm(restaurantId, product, defaultSortOrder);

  const createMutation = useCreateProduct(restaurantId);
  const updateMutation = useUpdateProduct(restaurantId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing && product) {
      await updateMutation.mutateAsync({ id: product.id, data: toUpdateData() });
    } else {
      await createMutation.mutateAsync(toCreateData());
    }
    onSuccess();
  }

  const mutationError = createMutation.error?.message ?? updateMutation.error?.message;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="space-y-6 p-6">

        {/* Categoría y nombre */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Categoría *"
            value={data.categoryId}
            onChange={(v) => handleChange('categoryId', v)}
            disabled={isPending}
            error={errors.categoryId}
            placeholder="Seleccioná una categoría"
            options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
          />

          <Input
            label="Nombre del producto"
            value={data.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={errors.name}
            placeholder="Ej: Hamburguesa clásica"
            required
            disabled={isPending}
          />
        </div>

        <Textarea
          label="Descripción"
          value={data.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Ingredientes, acompañamientos..."
          rows={2}
          disabled={isPending}
        />

        {/* Precio, orden y tag */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Input
              label="Precio"
              type="number"
              value={String(data.price)}
              onChange={(e) => handleChange('price', Number(e.target.value))}
              error={errors.price}
              min="0"
              step="100"
              required
              disabled={isPending}
              hint={data.price > 0 ? formatCurrency(data.price) : undefined}
            />
          </div>

          <Input
            label="Orden"
            type="number"
            value={String(data.sortOrder)}
            onChange={(e) => handleChange('sortOrder', Number(e.target.value))}
            error={errors.sortOrder}
            min="1"
            required
            disabled={isPending}
          />

          <Select
            label="Tag especial"
            value={data.tag ?? ''}
            onChange={(v) => handleChange('tag', v)}
            disabled={isPending}
            placeholder="Sin tag especial"
            options={[
              { value: '',                        label: 'Sin tag especial' },
              { value: '🔥 El más pedido',        label: '🔥 El más pedido' },
              { value: '💝 El favorito de todos', label: '💝 El favorito de todos' },
              { value: '⭐ Recomendado hoy',      label: '⭐ Recomendado hoy' },
              { value: '✨ Nuevo',                label: '✨ Nuevo' },
              { value: '🏆 El clásico',           label: '🏆 El clásico' },
              { value: '🌀 Edición especial',     label: '🌀 Edición especial' },
            ]}
          />
        </div>

        {/* Imagen */}
        <ImageUpload
          label="Imagen del producto"
          value={data.image}
          onChange={(url) => handleChange('image', url)}
          disabled={isPending}
          aspectRatio="wide"
          objectFit="contain"
        />

        {/* Adicionales */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--t-text-2)]">Adicionales</h3>
            <Link
              href={ROUTES.dashboard.adicionales}
              className="text-xs font-medium text-orange-600 hover:text-orange-700"
              tabIndex={-1}
            >
              Administrar catálogo →
            </Link>
          </div>

          {adicionales.length === 0 ? (
            <p className="text-xs text-[var(--t-text-4)]">
              No hay adicionales creados.{' '}
              <Link href={ROUTES.dashboard.adicionales} className="font-medium text-orange-600 hover:underline">
                Crear adicionales →
              </Link>
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {adicionales.map((a) => {
                const checked = data.adicionalIds.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors ${!a.isActive ? 'opacity-50' : ''}`}
                    style={checked
                      ? { borderColor: '#fb923c', backgroundColor: 'rgba(249,115,22,0.08)' }
                      : { borderColor: 'var(--t-border)', backgroundColor: 'transparent' }
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAdicionalId(a.id)}
                      disabled={isPending || !a.isActive}
                      className="h-4 w-4 rounded flex-shrink-0"
                      style={{ accentColor: '#f97316' }}
                    />
                    <span className="flex-1 text-sm font-medium text-[var(--t-text-1)]">{a.name}</span>
                    <span className="text-xs font-bold text-orange-500 flex-shrink-0">
                      +{formatCurrency(a.price)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {/* Switches de estado */}
        <div className="flex gap-6">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={data.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="h-4 w-4 rounded accent-orange-500"
              disabled={isPending}
            />
            <span className="text-sm font-medium text-[var(--t-text-2)]">Activo en el menú</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={data.isAvailable}
              onChange={(e) => handleChange('isAvailable', e.target.checked)}
              className="h-4 w-4 rounded accent-orange-500"
              disabled={isPending}
            />
            <span className="text-sm font-medium text-[var(--t-text-2)]">Disponible hoy</span>
          </label>
        </div>

        {mutationError && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{mutationError}</p>
        )}
      </div>

      <div className="flex gap-3 border-t border-[var(--t-border)] px-6 py-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" isLoading={isPending} className="flex-1">
          {isEditing ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </div>
    </form>
  );
}
