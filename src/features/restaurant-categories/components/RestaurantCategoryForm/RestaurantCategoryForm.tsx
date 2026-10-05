'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/constants/routes';
import { useToastStore } from '@/store/toast.store';
import type { SaveRestaurantCategoryData } from '@/types';

import { useRestaurantCategory, useSaveRestaurantCategory } from '../../hooks/useRestaurantCategories';

const sg = 'var(--font-sans, sans-serif)';
const ORANGE = '#FF6A1A';

const EMPTY: SaveRestaurantCategoryData = {
  name: '', slug: '', icon: '', sortOrder: 1, isActive: true,
};

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function RestaurantCategoryForm({ categoryId }: { categoryId?: string }) {
  const router = useRouter();
  const { data: category, isLoading } = useRestaurantCategory(categoryId);
  const save = useSaveRestaurantCategory();
  const { showToast } = useToastStore();
  const [form, setForm] = useState<SaveRestaurantCategoryData>(EMPTY);
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    if (!category) return;
    setForm({ name: category.name, slug: category.slug, icon: category.icon ?? '', sortOrder: category.sortOrder, isActive: category.isActive });
    setSlugEdited(true);
  }, [category]);

  const set = <K extends keyof SaveRestaurantCategoryData>(key: K, value: SaveRestaurantCategoryData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function handleNameChange(value: string) {
    set('name', value);
    if (!slugEdited) set('slug', toSlug(value));
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    if (!form.slug.trim()) { showToast('El slug es obligatorio', 'error'); return; }
    try {
      await save.mutateAsync({ id: categoryId, data: form });
      showToast(categoryId ? 'Categoría actualizada' : 'Categoría creada', 'success');
      router.push(ROUTES.admin.categorias);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    }
  }

  if (isLoading) return <p style={{ color: 'var(--t-text-3)', fontSize: 14, fontFamily: sg }}>Cargando…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 520, margin: '0 auto', fontFamily: sg }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link
          href={ROUTES.admin.categorias}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--t-text-3)', textDecoration: 'none' }}
        >
          <ArrowLeft size={14} /> Volver a categorías
        </Link>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>
          {categoryId ? 'Editar categoría' : 'Nueva categoría'}
        </h2>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Nombre"
          value={form.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Ej: Comida rápida"
        />

        <Input
          label="Slug"
          value={form.slug}
          onChange={(e) => { setSlugEdited(true); set('slug', e.target.value); }}
          placeholder="comida-rapida"
          hint="Identificador único en minúsculas. Se usa en la URL y búsquedas."
        />

        <Input
          label="Ícono (emoji)"
          value={form.icon ?? ''}
          onChange={(e) => set('icon', e.target.value)}
          placeholder="🍔"
          hint="Opcional. Un emoji que represente la categoría."
        />

        <Input
          label="Orden"
          type="number"
          value={String(form.sortOrder)}
          onChange={(e) => set('sortOrder', parseInt(e.target.value, 10) || 1)}
          hint="Menor número = aparece primero."
        />

        {/* Activa */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--t-text-1)' }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            style={{ width: 16, height: 16, accentColor: ORANGE }}
          />
          Activa (visible para los restaurantes y en el home)
        </label>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Link
          href={ROUTES.admin.categorias}
          style={{ padding: '10px 20px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text-2)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={save.isPending}
          style={{ padding: '10px 24px', borderRadius: 999, background: ORANGE, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: save.isPending ? 0.7 : 1 }}
        >
          {save.isPending ? 'Guardando…' : categoryId ? 'Guardar cambios' : 'Crear categoría'}
        </button>
      </div>
    </div>
  );
}
