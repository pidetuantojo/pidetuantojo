'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Adicional } from '@/types';

import {
  useAdicionales,
  useCreateAdicional,
  useUpdateAdicional,
  useDeleteAdicional,
} from '../../hooks/useAdicionales';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

interface Props {
  restaurantId: string;
}

const EMPTY_FORM = { name: '', price: '', isActive: true };

export function AdicionalesManager({ restaurantId }: Props) {
  const { data: adicionales = [], isLoading } = useAdicionales(restaurantId);
  const createMutation = useCreateAdicional(restaurantId);
  const updateMutation = useUpdateAdicional(restaurantId);
  const deleteMutation = useDeleteAdicional(restaurantId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const isPending = createMutation.isPending || updateMutation.isPending;

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(a: Adicional) {
    setEditingId(a.id);
    setForm({ name: a.name, price: String(a.price), isActive: a.isActive });
    setFormError('');
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setFormError('');
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('El nombre es requerido'); return; }
    const price = Number(form.price);
    if (isNaN(price) || price < 0) { setFormError('El precio no es válido'); return; }

    const payload = { name: form.name.trim(), price, isActive: form.isActive };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    cancel();
  }

  async function handleToggle(a: Adicional) {
    await updateMutation.mutateAsync({ id: a.id, data: { isActive: !a.isActive } });
  }

  async function handleDelete(a: Adicional) {
    if (!confirm(`¿Eliminar "${a.name}"? Los productos que lo usan ya no lo mostrarán.`)) return;
    await deleteMutation.mutateAsync(a.id);
  }

  return (
    <div style={{ fontFamily: sg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: 'var(--t-text-1)', margin: 0 }}>
            Adicionales
          </h1>
          <p style={{ fontSize: 13, color: 'var(--t-text-3)', margin: '4px 0 0' }}>
            Complementos que el cliente puede agregar a cualquier producto.
          </p>
        </div>
        <button
          onClick={openNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#FF6A1A', color: '#fff', border: 'none',
            borderRadius: 999, padding: '10px 18px', fontFamily: sg,
            fontWeight: 600, fontSize: 14, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Plus size={16} />
          Nuevo adicional
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: 'var(--t-surface)', borderRadius: 14, border: '1px solid var(--t-border-2)', height: 64, opacity: 0.5 }} />
          ))}
        </div>
      ) : adicionales.length === 0 ? (
        <div style={{
          background: 'var(--t-surface)', borderRadius: 18, border: '1.5px dashed var(--t-border)',
          padding: 48, textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🍬</div>
          <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--t-text-1)', margin: '0 0 6px' }}>Sin adicionales aún</p>
          <p style={{ fontSize: 13, color: 'var(--t-text-3)', margin: 0 }}>
            Crea el primero para poder asignarlo a tus productos.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {adicionales.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'var(--t-surface)', borderRadius: 14, border: '1px solid var(--t-border-2)',
                padding: '14px 18px', opacity: a.isActive ? 1 : 0.55,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--t-text-1)' }}>{a.name}</span>
                  {!a.isActive && (
                    <span style={{
                      background: 'var(--t-surface-2)', color: 'var(--t-text-4)', fontSize: 10,
                      fontFamily: sm, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      letterSpacing: '.06em',
                    }}>
                      INACTIVO
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: sm, fontSize: 12, fontWeight: 700, color: '#FF6A1A' }}>
                  +{formatCurrency(a.price)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => handleToggle(a)}
                  title={a.isActive ? 'Desactivar' : 'Activar'}
                  style={{ padding: 8, borderRadius: 999, border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  {a.isActive
                    ? <Check size={16} color="#22c55e" />
                    : <X size={16} color="var(--t-text-4)" />
                  }
                </button>
                <button
                  onClick={() => openEdit(a)}
                  style={{ padding: 8, borderRadius: 999, border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  <Edit2 size={15} color="var(--t-text-3)" />
                </button>
                <button
                  onClick={() => handleDelete(a)}
                  disabled={deleteMutation.isPending}
                  style={{ padding: 8, borderRadius: 999, border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  <Trash2 size={15} color="#f87171" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showForm}
        onClose={cancel}
        title={editingId ? 'Editar adicional' : 'Nuevo adicional'}
        size="sm"
      >
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--t-text-2)', marginBottom: 6, fontFamily: sg }}>
              Nombre *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ej: Chamoy, Gomitas (4und)"
              style={{
                width: '100%', border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)',
                borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: sg,
                color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--t-text-2)', marginBottom: 6, fontFamily: sg }}>
              Precio
            </label>
            <input
              type="number"
              min={0}
              step={100}
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              placeholder="0"
              style={{
                width: '100%', border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)',
                borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: sg,
                color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              style={{ accentColor: '#FF6A1A', width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-text-2)', fontFamily: sg }}>Activo</span>
          </label>

          {formError && (
            <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{formError}</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '0 24px 20px', borderTop: '1px solid var(--t-border)', paddingTop: 16, marginTop: 4 }}>
          <Button variant="secondary" onClick={cancel} disabled={isPending} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} isLoading={isPending} className="flex-1">
            {editingId ? 'Guardar cambios' : 'Crear adicional'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
