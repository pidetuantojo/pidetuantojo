'use client';

import Link from 'next/link';

import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { TemplatePreview } from '@/features/wa-templates/components/TemplateEditor';
import { DELIVERY_KINDS, templateBody, WA_EVENTS } from '@/lib/whatsapp/templates.core';
import { useWaTemplates } from '@/lib/whatsapp/useWaTemplates';

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

  // Estado fijo: nombre, código y color bloqueados; el aviso de WhatsApp sí se configura
  const isBase = !!status?.isBase;
  const { can } = useAuth();
  // Mesa solo si el plan incluye comer en el local
  const deliveryKinds = DELIVERY_KINDS.filter((k) => k.value !== 'mesa' || can('features.dine_in'));
  const notifiesSomewhere = deliveryKinds.some((k) => data.notifyByDelivery[k.value]);
  const { store } = useWaTemplates(restaurantId);
  // "Pedido pagado" no es un estado: no se ofrece
  const templateOptions = [
    ...WA_EVENTS.filter((e) => e.code !== 'pedido_pagado').map((e) => ({ value: e.code, label: `${e.emoji} ${e.label}` })),
    ...(store?.custom ?? []).map((t) => ({ value: t.id, label: `✨ ${t.name}` })),
  ];

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
          disabled={isPending || isBase}
        />

        <Input
          label="Código"
          value={data.code}
          onChange={(e) => handleChange('code', e.target.value)}
          error={errors.code}
          placeholder="en_camino"
          hint={isBase ? 'Estado fijo: el nombre, el código y el color no se pueden cambiar' : isEditing ? 'El código no se puede editar' : 'Se auto-genera desde el nombre'}
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
              disabled={isPending || isBase}
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
          <Checkbox
            checked={data.isActive}
            onChange={(e) => handleChange('isActive', e.target.checked)}
            disabled={isPending}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--t-text-2)' }}>Estado activo</span>
        </label>

        {/* Aviso por WhatsApp */}
        <div className="space-y-3 rounded-xl p-4" style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface-2)' }}>
          <div>
            <span className="block text-sm font-medium" style={{ color: 'var(--t-text-1)' }}>Avisar al cliente por WhatsApp</span>
            <span className="block text-xs" style={{ color: 'var(--t-text-3)' }}>
              Marca en qué tipos de pedido se envía el aviso cuando el pedido pasa a este estado (si los mensajes automáticos están activos).
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {deliveryKinds.map((k) => {
              const checked = data.notifyByDelivery[k.value];
              return (
                <label
                  key={k.value}
                  className="flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
                  style={{
                    border: `1.5px solid ${checked ? '#FF6A1A' : 'var(--t-border)'}`,
                    background: checked ? 'rgba(255,106,26,.08)' : 'var(--t-surface)',
                    color: 'var(--t-text-1)',
                  }}
                >
                  <Checkbox
                    checked={checked}
                    onChange={(e) => handleChange('notifyByDelivery', { ...data.notifyByDelivery, [k.value]: e.target.checked })}
                    disabled={isPending}
                  />
                  {k.emoji} {k.label}
                </label>
              );
            })}
          </div>
          {!notifiesSomewhere && (
            <p className="text-xs" style={{ color: 'var(--t-text-4)' }}>Este estado no le avisa al cliente en ningún tipo de pedido.</p>
          )}

          {notifiesSomewhere && (
            <>
              <Select
                label="Plantilla"
                value={data.waTemplateId}
                onChange={(v) => handleChange('waTemplateId', v)}
                options={templateOptions}
                disabled={isPending}
              />
              <Link href={ROUTES.dashboard.notificaciones.plantillas} className="inline-block text-xs font-semibold" style={{ color: '#FF6A1A' }}>
                + Crear o editar plantillas
              </Link>
              {store && <TemplatePreview body={templateBody(store, data.waTemplateId)} statusName={data.name} />}
            </>
          )}
        </div>

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
