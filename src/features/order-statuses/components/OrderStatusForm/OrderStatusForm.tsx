'use client';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

import { useOrderStatusForm } from '../../hooks/useOrderStatusForm';
import {
  useCreateOrderStatus,
  useUpdateOrderStatus,
} from '../../hooks/useOrderStatusMutations';
import type { OrderStatusFormProps } from './OrderStatusForm.types';

export function OrderStatusForm({
  status,
  restaurantId,
  defaultSortOrder = 1,
  onSuccess,
  onCancel,
}: OrderStatusFormProps) {
  const { data, errors, handleChange, validate, toCreateData, toUpdateData, isEditing } =
    useOrderStatusForm(restaurantId, status, defaultSortOrder);

  const createMutation = useCreateOrderStatus(restaurantId);
  const updateMutation = useUpdateOrderStatus(restaurantId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing && status) {
      await updateMutation.mutateAsync({ id: status.id, data: toUpdateData() });
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
          label="Nombre del estado"
          value={data.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          placeholder="Ej: En camino, En caja..."
          required
          disabled={isPending}
        />

        <Input
          label="Código"
          value={data.code}
          onChange={(e) => handleChange('code', e.target.value)}
          error={errors.code}
          placeholder="en_camino"
          hint={isEditing ? 'El código no se puede editar' : 'Se auto-genera desde el nombre'}
          required
          disabled={isPending || isEditing}
        />

        {/* Color */}
        <div className="space-y-1">
          <label className="block text-sm font-medium" style={{ color: 'var(--t-text-2)' }}>Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={data.color}
              onChange={(e) => handleChange('color', e.target.value)}
              disabled={isPending}
              className="h-10 w-16 cursor-pointer rounded-lg p-0.5"
              style={{ border: '1px solid var(--t-input-border)' }}
            />
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-white"
              style={{ backgroundColor: data.color }}
            >
              <span className="h-2 w-2 rounded-full bg-white/60" />
              {data.name || 'Vista previa'}
            </div>
          </div>
        </div>

        <Input
          label="Orden de aparición"
          type="number"
          value={String(data.sortOrder)}
          onChange={(e) => handleChange('sortOrder', Number(e.target.value))}
          error={errors.sortOrder}
          hint="Número menor aparece primero en el flujo"
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
          <span className="text-sm font-medium" style={{ color: 'var(--t-text-2)' }}>Estado activo</span>
        </label>

        {mutationError && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{mutationError}</p>
        )}
      </div>

      <div
        className="flex gap-3 px-6 py-4"
        style={{ borderTop: '1px solid var(--t-border)' }}
      >
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" isLoading={isPending} className="flex-1">
          {isEditing ? 'Guardar cambios' : 'Crear estado'}
        </Button>
      </div>
    </form>
  );
}
