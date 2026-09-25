'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, GripVertical, Tag } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/features/auth';
import type { Category } from '@/types';

import { useCategories } from '../../hooks/useCategories';
import {
  useToggleCategoryActive,
  useDeleteCategory,
} from '../../hooks/useCategoryMutations';
import { CategoryForm } from '../CategoryForm';

export function CategoriesManager() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  const { data: categories = [], isLoading, error } = useCategories(restaurantId);

  const toggleActive = useToggleCategoryActive(restaurantId);
  const deleteCategory = useDeleteCategory(restaurantId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>(undefined);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleEdit(category: Category) {
    setEditing(category);
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
    if (!confirm(`¿Eliminar la categoría "${name}"?`)) return;
    setDeletingId(id);
    try {
      await deleteCategory.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  }

  if (!restaurantId) {
    return (
      <p className="text-sm text-red-600">Tu cuenta no tiene un restaurante asignado.</p>
    );
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
        Error al cargar las categorías.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--t-text-1)' }}>Categorías</h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--t-text-2)' }}>
            {categories.length} categoría{categories.length !== 1 ? 's' : ''} — se muestran en el
            menú por orden de aparición
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      {/* Lista */}
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Tag className="h-12 w-12 text-[var(--t-text-4)]" />
          <h3 className="mt-4 text-lg font-medium text-[var(--t-text-1)]">Sin categorías</h3>
          <p className="mt-1 text-sm text-[var(--t-text-3)]">
            Creá las categorías para organizar tu menú.
          </p>
          <Button onClick={handleAdd} className="mt-4">
            <Plus className="h-4 w-4" />
            Crear primera categoría
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center gap-4 rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-3 shadow-sm"
            >
              {/* Drag handle (visual) */}
              <GripVertical className="h-5 w-5 flex-shrink-0 text-[var(--t-text-4)]" />

              {/* Sort order */}
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
                {category.sortOrder}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[var(--t-text-1)] truncate">{category.name}</p>
                  <Badge variant={category.isActive ? 'success' : 'default'}>
                    {category.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                {category.description && (
                  <p className="mt-0.5 truncate text-sm text-[var(--t-text-3)]">{category.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  onClick={() => handleToggleActive(category.id, !category.isActive)}
                  disabled={togglingId === category.id}
                  className="rounded-lg p-2 text-[var(--t-text-4)] transition-colors hover:bg-[var(--t-surface-2)] hover:text-[var(--t-text-2)] disabled:opacity-50"
                  title={category.isActive ? 'Desactivar' : 'Activar'}
                >
                  {category.isActive ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>

                <button
                  onClick={() => handleEdit(category)}
                  className="rounded-lg p-2 text-[var(--t-text-4)] transition-colors hover:bg-blue-50 hover:text-blue-600"
                  title="Editar"
                >
                  <Edit className="h-4 w-4" />
                </button>

                <button
                  onClick={() => handleDelete(category.id, category.name)}
                  disabled={deletingId === category.id}
                  className="rounded-lg p-2 text-[var(--t-text-4)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleClose}
        title={editing ? `Editar: ${editing.name}` : 'Nueva categoría'}
        size="md"
      >
        <CategoryForm
          category={editing}
          restaurantId={restaurantId}
          defaultSortOrder={categories.length + 1}
          onSuccess={handleClose}
          onCancel={handleClose}
        />
      </Modal>
    </div>
  );
}
