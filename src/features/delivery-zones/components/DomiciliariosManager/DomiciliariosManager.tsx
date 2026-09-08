'use client';

import { useState } from 'react';

import { useAuth } from '@/features/auth';
import type { Domiciliario } from '@/types';

import { useDomiciliarios } from '../../hooks/useDomiciliarios';
import {
  useCreateDomiciliario,
  useUpdateDomiciliario,
  useDeleteDomiciliario,
} from '../../hooks/useDomiciliarioMutations';

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
const sm = "var(--font-space-mono, monospace)";

const C = {
  primary: '#FF6A1A',
  bg: '#FBF8F5',
  border: '#EFE7DF',
  dark: '#1B1512',
  muted: '#9a8f86',
};

interface FormState {
  name: string;
  code: string;
  phone: string;
}

const emptyForm: FormState = { name: '', code: '', phone: '' };

export function DomiciliariosManager() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  const { data: drivers = [], isLoading, error } = useDomiciliarios(restaurantId || undefined);
  const create = useCreateDomiciliario(restaurantId);
  const update = useUpdateDomiciliario(restaurantId);
  const remove = useDeleteDomiciliario(restaurantId);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Domiciliario | undefined>(undefined);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function openAdd() {
    setEditing(undefined);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(d: Domiciliario) {
    setEditing(d);
    setForm({ name: d.name, code: d.code, phone: d.phone });
    setFormError('');
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(undefined);
    setForm(emptyForm);
    setFormError('');
  }

  async function handleSave() {
    const name = form.name.trim();
    const code = form.code.trim();
    const phone = form.phone.trim();
    if (!name) { setFormError('El nombre es requerido'); return; }
    if (!code) { setFormError('El código es requerido'); return; }
    if (!phone) { setFormError('El número es requerido'); return; }

    setFormError('');
    if (editing) {
      await update.mutateAsync({ id: editing.id, data: { name, code, phone } });
    } else {
      await create.mutateAsync({ restaurantId, name, code, phone, isActive: true });
    }
    cancelForm();
  }

  async function handleToggleActive(d: Domiciliario) {
    setTogglingId(d.id);
    try {
      await update.mutateAsync({ id: d.id, data: { isActive: !d.isActive } });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(d: Domiciliario) {
    if (!confirm(`¿Eliminar a "${d.name}"?`)) return;
    setDeletingId(d.id);
    try {
      await remove.mutateAsync(d.id);
    } finally {
      setDeletingId(null);
    }
  }

  if (!restaurantId) {
    return <p style={{ fontFamily: sg, fontSize: 14, color: '#ef4444' }}>Tu cuenta no tiene un restaurante asignado.</p>;
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid #FF6A1A', borderTopColor: 'transparent', display: 'block', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontFamily: sg, fontSize: 14, color: '#b91c1c' }}>
        Error al cargar los domiciliarios.
      </div>
    );
  }

  const isPending = create.isPending || update.isPending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: sg }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.dark, letterSpacing: '-.02em' }}>
            Domiciliarios
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: C.muted }}>
            Personal de entrega disponible para asignar a pedidos
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 999, border: 'none',
            background: C.primary, color: '#fff',
            fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo domiciliario
        </button>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <section style={{ background: '#fff', border: `1.5px solid ${C.primary}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: C.dark }}>
            {editing ? `Editar: ${editing.name}` : 'Nuevo domiciliario'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'name', label: 'Nombre completo', placeholder: 'Ej: Juan Pérez' },
              { key: 'code', label: 'Código', placeholder: 'Ej: D-01' },
              { key: 'phone', label: 'Número de celular', placeholder: 'Ej: 3001234567' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>
                  {label}
                </label>
                <input
                  type={key === 'phone' ? 'tel' : 'text'}
                  value={form[key as keyof FormState]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10,
                    padding: '10px 12px', fontSize: 14, fontFamily: sg, color: C.dark,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            {formError && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{formError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={cancelForm} style={{ flex: 1, padding: '10px', borderRadius: 999, border: `1.5px solid ${C.border}`, background: '#fff', fontFamily: sg, fontWeight: 600, fontSize: 14, color: C.muted, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isPending} style={{ flex: 2, padding: '10px', borderRadius: 999, border: 'none', background: C.primary, color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
                {isPending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Lista */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: C.muted, textTransform: 'uppercase' }}>
            Domiciliarios ({drivers.length})
          </span>
        </div>

        {drivers.length === 0 ? (
          <div style={{ border: `2px dashed ${C.border}`, borderRadius: 16, padding: '40px 20px', textAlign: 'center', background: C.bg }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛵</div>
            <p style={{ fontFamily: sg, fontWeight: 700, fontSize: 15, color: C.dark, margin: '0 0 6px' }}>
              Sin domiciliarios registrados
            </p>
            <p style={{ fontFamily: sg, fontSize: 13, color: C.muted, margin: '0 0 16px' }}>
              Agregá tu personal de entrega para asignarlos a los pedidos
            </p>
            <button onClick={openAdd} style={{ fontFamily: sg, fontWeight: 700, fontSize: 13, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 999 }}>
              + Agregar domiciliario
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {drivers.map((d) => (
              <DriverRow
                key={d.id}
                driver={d}
                onEdit={openEdit}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
                isToggling={togglingId === d.id}
                isDeleting={deletingId === d.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface DriverRowProps {
  driver: Domiciliario;
  onEdit: (d: Domiciliario) => void;
  onToggleActive: (d: Domiciliario) => void;
  onDelete: (d: Domiciliario) => void;
  isToggling?: boolean;
  isDeleting?: boolean;
}

function DriverRow({ driver, onEdit, onToggleActive, onDelete, isToggling, isDeleting }: DriverRowProps) {
  const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
  const sm = "var(--font-space-mono, monospace)";

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #EFE7DF', borderRadius: 14, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
      {/* Avatar */}
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#FFF3EA', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FF6A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: sg, fontWeight: 700, fontSize: 14, color: '#1B1512' }}>{driver.name}</span>
          <span style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, color: '#FF6A1A', background: '#FFF3EA', padding: '2px 8px', borderRadius: 999 }}>{driver.code}</span>
        </div>
        <span style={{ fontFamily: sg, fontSize: 12, color: '#9a8f86' }}>{driver.phone}</span>
      </div>

      {/* Estado */}
      <span style={{ padding: '4px 10px', borderRadius: 999, fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', background: driver.isActive ? '#d1fae5' : '#f3f4f6', color: driver.isActive ? '#059669' : '#6b7280', flexShrink: 0 }}>
        {driver.isActive ? 'Activo' : 'Inactivo'}
      </span>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={() => onToggleActive(driver)} disabled={isToggling} title={driver.isActive ? 'Desactivar' : 'Activar'} style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'none', cursor: isToggling ? 'default' : 'pointer', display: 'grid', placeItems: 'center', color: '#9a8f86', opacity: isToggling ? 0.5 : 1 }}>
          {driver.isActive ? (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>

        <button onClick={() => onEdit(driver)} title="Editar" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#9a8f86' }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>

        <button onClick={() => onDelete(driver)} disabled={isDeleting} title="Eliminar" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'none', cursor: isDeleting ? 'default' : 'pointer', display: 'grid', placeItems: 'center', color: '#9a8f86', opacity: isDeleting ? 0.5 : 1 }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
