'use client';

import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

import { useCategoryForm } from '../../hooks/useCategoryForm';
import { useCreateCategory, useUpdateCategory } from '../../hooks/useCategoryMutations';
import type { CategoryFormProps } from './CategoryForm.types';

export function CategoryForm({
  category,
  restaurantId,
  defaultSortOrder = 1,
  onSuccess,
  onCancel,
}: CategoryFormProps) {
  const { data, errors, handleChange, validate, toCreateData, toUpdateData, isEditing } =
    useCategoryForm(restaurantId, category, defaultSortOrder);

  const createMutation = useCreateCategory(restaurantId);
  const updateMutation = useUpdateCategory(restaurantId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing && category) {
      await updateMutation.mutateAsync({ id: category.id, data: toUpdateData() });
    } else {
      await createMutation.mutateAsync(toCreateData());
    }
    onSuccess();
  }

  const mutationError = createMutation.error?.message ?? updateMutation.error?.message;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="space-y-4 p-6">
        <Input
          label="Nombre de la categoría"
          value={data.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          placeholder="Ej: Entradas, Bebidas, Postres..."
          required
          disabled={isPending}
        />

        <Textarea
          label="Descripción"
          value={data.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Descripción opcional..."
          rows={2}
          disabled={isPending}
        />

        <Input
          label="Orden de aparición"
          type="number"
          value={String(data.sortOrder)}
          onChange={(e) => handleChange('sortOrder', Number(e.target.value))}
          error={errors.sortOrder}
          hint="Número menor aparece primero en el menú"
          min="1"
          required
          disabled={isPending}
        />

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={data.isActive}
            onChange={(e) => handleChange('isActive', e.target.checked)}
            className="h-4 w-4 rounded accent-orange-500"
            disabled={isPending}
          />
          <span className="text-sm font-medium text-[var(--t-text-2)]">Categoría activa</span>
        </label>

        {mutationError && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{mutationError}</p>
        )}
      </div>

      <div className="flex gap-3 border-t border-[var(--t-border)] px-6 py-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" isLoading={isPending} className="flex-1">
          {isEditing ? 'Guardar cambios' : 'Crear categoría'}
        </Button>
      </div>
    </form>
  );
}
