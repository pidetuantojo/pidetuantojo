'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Lock, ListOrdered } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/features/auth';
import type { OrderStatus } from '@/types';

import { useOrderStatuses } from '../../hooks/useOrderStatuses';
import {
  useToggleOrderStatusActive,
  useDeleteOrderStatus,
} from '../../hooks/useOrderStatusMutations';
import { OrderStatusForm } from '../OrderStatusForm';

export function OrderStatusesManager() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  const { data: statuses = [], isLoading, error } = useOrderStatuses(restaurantId);

  const toggleActive = useToggleOrderStatusActive(restaurantId);
  const deleteStatus = useDeleteOrderStatus(restaurantId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrderStatus | undefined>(undefined);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleEdit(status: OrderStatus) {
    setEditing(status);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function handleClose() {
    setModalOpen(false);
    setEditing(undefined);
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setTogglingId(id);
    try {
      await toggleActive.mutateAsync({ id, isActive });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el estado "${name}"?`)) return;
    setDeletingId(id);
    try {
      await deleteStatus.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  }

  if (!restaurantId) {
    return <p className="text-sm text-red-600">Tu cuenta no tiene un restaurante asignado.</p>;
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
        Error al cargar los estados.
      </div>
    );
  }

  const baseStatuses = statuses.filter((s) => s.isBase);
  const customStatuses = statuses.filter((s) => !s.isBase);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--t-text-1)' }}>Estados de pedido</h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--t-text-3)' }}>
            Flujo de estados para gestionar los pedidos de tu restaurante
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Nuevo estado
        </Button>
      </div>

      {/* Estados base */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4" style={{ color: 'var(--t-text-4)' }} />
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--t-text-3)' }}>
            Estados base (no eliminables)
          </h3>
        </div>

        <div className="space-y-2">
          {baseStatuses.map((status) => (
            <StatusRow
              key={status.id}
              status={status}
              onToggleActive={handleToggleActive}
              isToggling={togglingId === status.id}
            />
          ))}
        </div>
      </section>

      {/* Estados personalizados */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4" style={{ color: 'var(--t-text-4)' }} />
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--t-text-3)' }}>
            Estados personalizados
          </h3>
        </div>

        {customStatuses.length === 0 ? (
          <div
            className="rounded-xl py-10 text-center"
            style={{ border: '2px dashed var(--t-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--t-text-4)' }}>
              No hay estados personalizados. Puedes agregar intermedios para tu flujo específico.
            </p>
            <button
              onClick={handleAdd}
              className="mt-3 text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              + Agregar estado
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {customStatuses.map((status) => (
              <StatusRow
                key={status.id}
                status={status}
                onEdit={handleEdit}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
                isToggling={togglingId === status.id}
                isDeleting={deletingId === status.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleClose}
        title={editing ? `Editar: ${editing.name}` : 'Nuevo estado'}
        size="md"
      >
        <OrderStatusForm
          status={editing}
          restaurantId={restaurantId}
          defaultSortOrder={statuses.length + 1}
          onSuccess={handleClose}
          onCancel={handleClose}
        />
      </Modal>
    </div>
  );
}

// Subcomponente interno — no se exporta
interface StatusRowProps {
  status: OrderStatus;
  onEdit?: (status: OrderStatus) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDelete?: (id: string, name: string) => void;
  isToggling?: boolean;
  isDeleting?: boolean;
}

function StatusRow({
  status,
  onEdit,
  onToggleActive,
  onDelete,
  isToggling,
  isDeleting,
}: StatusRowProps) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl px-4 py-3 shadow-sm"
      style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
    >
      {/* Color dot + sortOrder */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--t-text-4)' }}>{status.sortOrder}</span>
        <span
          className="h-4 w-4 rounded-full ring-2 ring-white ring-offset-1"
          style={{ backgroundColor: status.color }}
        />
      </div>

      {/* Info */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <div
          className="rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: status.color }}
        >
          {status.name}
        </div>
        <code
          className="rounded px-1.5 py-0.5 font-mono text-xs"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-3)' }}
        >
          {status.code}
        </code>
      </div>

      {/* Badges */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {status.isBase && (
          <Badge variant="info">Base</Badge>
        )}
        <Badge variant={status.isActive ? 'success' : 'default'}>
          {status.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          onClick={() => onToggleActive(status.id, !status.isActive)}
          disabled={isToggling}
          className="rounded-lg p-2 transition-colors disabled:opacity-50"
          style={{ color: 'var(--t-text-4)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--t-surface-2)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--t-text-2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--t-text-4)';
          }}
          title={status.isActive ? 'Desactivar' : 'Activar'}
        >
          {status.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>

        {!status.isBase && onEdit && (
          <button
            onClick={() => onEdit(status)}
            className="rounded-lg p-2 transition-colors hover:bg-blue-50 hover:text-blue-600"
            style={{ color: 'var(--t-text-4)' }}
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </button>
        )}

        {!status.isBase && onDelete && (
          <button
            onClick={() => onDelete(status.id, status.name)}
            disabled={isDeleting}
            className="rounded-lg p-2 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            style={{ color: 'var(--t-text-4)' }}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
