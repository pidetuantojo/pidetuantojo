'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Lock, ChevronUp, ChevronDown } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/features/auth';
import { useConfirmStore } from '@/store/confirm.store';
import type { OrderStatus } from '@/types';

import { useOrderStatuses } from '../../hooks/useOrderStatuses';
import {
  useUpdateOrderStatus,
  useToggleOrderStatusActive,
  useDeleteOrderStatus,
} from '../../hooks/useOrderStatusMutations';
import { OrderStatusForm } from '../OrderStatusForm';

export function OrderStatusesManager() {
  const { user, can } = useAuth();
  const canUpdate = can('order_statuses.update');
  const canDelete = can('order_statuses.delete');
  const restaurantId = user?.restaurantId ?? '';

  const { data: statuses = [], isLoading, error } = useOrderStatuses(restaurantId);

  const updateStatus = useUpdateOrderStatus(restaurantId);
  const toggleActive = useToggleOrderStatusActive(restaurantId);
  const deleteStatus = useDeleteOrderStatus(restaurantId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrderStatus | undefined>(undefined);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const { showConfirm } = useConfirmStore();

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
    if (!await showConfirm({ message: `¿Eliminar el estado "${name}"? Esta acción no se puede deshacer.` })) return;
    setDeletingId(id);
    try {
      await deleteStatus.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= statuses.length) return;

    const current = statuses[index];
    const target = statuses[targetIndex];
    setMovingId(current.id);
    try {
      // Intercambiar sortOrder usando la posición en el array (evita duplicados)
      await Promise.all([
        updateStatus.mutateAsync({ id: current.id, data: { sortOrder: targetIndex + 1 } }),
        updateStatus.mutateAsync({ id: target.id, data: { sortOrder: index + 1 } }),
      ]);
    } finally {
      setMovingId(null);
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--t-text-1)' }}>Estados de pedido</h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--t-text-3)' }}>
            Definí el orden del flujo combinando estados base y personalizados
          </p>
        </div>
        {can('order_statuses.create') && (
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Nuevo estado
          </Button>
        )}
      </div>

      {/* Lista unificada ordenada por sortOrder */}
      <section className="space-y-2">
        {statuses.map((status, index) => (
          <StatusRow
            key={status.id}
            status={status}
            index={index}
            total={statuses.length}
            canMove={canUpdate}
            onMoveUp={canUpdate ? () => handleMove(index, 'up') : undefined}
            onMoveDown={canUpdate ? () => handleMove(index, 'down') : undefined}
            onEdit={canUpdate && !status.isBase ? handleEdit : undefined}
            onToggleActive={canUpdate ? handleToggleActive : undefined}
            onDelete={canDelete && !status.isBase ? handleDelete : undefined}
            isToggling={togglingId === status.id}
            isDeleting={deletingId === status.id}
            isMoving={movingId === status.id}
          />
        ))}

        {statuses.length === 0 && (
          <div
            className="rounded-xl py-10 text-center"
            style={{ border: '2px dashed var(--t-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--t-text-4)' }}>
              No hay estados configurados.
            </p>
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

// ─── StatusRow ────────────────────────────────────────────────────────────────

interface StatusRowProps {
  status: OrderStatus;
  index: number;
  total: number;
  canMove?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onEdit?: (status: OrderStatus) => void;
  onToggleActive?: (id: string, isActive: boolean) => void;
  onDelete?: (id: string, name: string) => void;
  isToggling?: boolean;
  isDeleting?: boolean;
  isMoving?: boolean;
}

function StatusRow({
  status,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onEdit,
  onToggleActive,
  onDelete,
  isToggling,
  isDeleting,
  isMoving,
}: StatusRowProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-3 shadow-sm"
      style={{
        border: '1px solid var(--t-border)',
        background: 'var(--t-surface)',
        opacity: isMoving ? 0.6 : 1,
        transition: 'opacity .15s',
      }}
    >
      {/* Botones de reorden */}
      <div className="flex flex-shrink-0 flex-col gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={index === 0 || isMoving || !onMoveUp}
          className="rounded p-0.5 transition-colors disabled:opacity-20"
          style={{ color: 'var(--t-text-4)' }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.color = 'var(--t-text-1)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--t-text-4)'; }}
          title="Subir"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1 || isMoving || !onMoveDown}
          className="rounded p-0.5 transition-colors disabled:opacity-20"
          style={{ color: 'var(--t-text-4)' }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.color = 'var(--t-text-1)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--t-text-4)'; }}
          title="Bajar"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Número + color */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="w-4 text-center text-xs font-medium" style={{ color: 'var(--t-text-4)' }}>
          {index + 1}
        </span>
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

      {/* Acciones */}
      <div className="flex flex-shrink-0 items-center gap-1">
        {onToggleActive && (
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
        )}

        {status.isBase ? (
          <span className="rounded-lg p-2" style={{ color: 'var(--t-text-4)', opacity: 0.4 }} title="Estado base — nombre y color fijos">
            <Lock className="h-4 w-4" />
          </span>
        ) : (
          <>
            {onEdit && (
              <button
                onClick={() => onEdit(status)}
                className="rounded-lg p-2 transition-colors hover:bg-blue-50 hover:text-blue-600"
                style={{ color: 'var(--t-text-4)' }}
                title="Editar"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
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
          </>
        )}
      </div>
    </div>
  );
}
