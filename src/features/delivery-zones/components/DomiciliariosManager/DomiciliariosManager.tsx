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

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

interface FormState {
  isCompany: boolean;
  name: string;
  code: string;
  phone: string;
}

const emptyForm: FormState = { isCompany: false, name: '', code: '', phone: '' };

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
    setForm({ isCompany: d.isCompany ?? false, name: d.name, code: d.code ?? '', phone: d.phone });
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
    const { isCompany } = form;
    const name = form.name.trim();
    const code = form.code.trim();
    const phone = form.phone.trim();
    if (!name) { setFormError(isCompany ? 'El nombre de la empresa es requerido' : 'El nombre es requerido'); return; }
    // El código solo aplica a domiciliarios individuales
    if (!isCompany && !code) { setFormError('El código es requerido'); return; }
    if (!phone) { setFormError('El número es requerido'); return; }

    setFormError('');
    if (editing) {
      // Al pasar a empresa, `code: undefined` borra el código guardado
      await update.mutateAsync({
        id: editing.id,
        data: { name, phone, isCompany, code: isCompany ? undefined : code },
      });
    } else {
      await create.mutateAsync({
        restaurantId, name, phone, isActive: true,
        ...(isCompany ? { isCompany: true } : { code }),
      });
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
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>
            Domiciliarios
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--t-text-3)' }}>
            Personal de entrega y empresas de domicilios para asignar a pedidos
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 999, border: 'none',
            background: '#FF6A1A', color: '#fff',
            fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo domiciliario
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) cancelForm(); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div style={{ background: 'var(--t-surface)', borderRadius: 20, padding: '24px 28px', width: 440, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--t-text-1)' }}>
                {editing ? `Editar: ${editing.name}` : 'Nuevo domiciliario'}
              </h3>
              <button onClick={cancelForm} style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'var(--t-surface-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)', fontSize: 16 }}>✕</button>
            </div>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', background: form.isCompany ? '#FFF3EA' : 'var(--t-surface-2)', border: `1.5px solid ${form.isCompany ? '#FF6A1A44' : 'var(--t-border-2)'}`, borderRadius: 12, padding: '10px 12px' }}>
                <input
                  type="checkbox"
                  checked={form.isCompany}
                  onChange={(e) => { setForm((p) => ({ ...p, isCompany: e.target.checked })); setFormError(''); }}
                  style={{ width: 16, height: 16, marginTop: 2, accentColor: '#FF6A1A', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--t-text-1)' }}>¿Es empresa de domicilios?</span>
                  <span style={{ fontSize: 12, color: 'var(--t-text-3)', lineHeight: 1.4 }}>
                    Al asignarla a un pedido vas a indicar qué domiciliario de la empresa lo tomó.
                  </span>
                </span>
              </label>

              {[
                form.isCompany
                  ? { key: 'name', label: 'Nombre de la empresa', placeholder: 'Ej: Domicilios Express' }
                  : { key: 'name', label: 'Nombre completo', placeholder: 'Ej: Juan Pérez' },
                ...(form.isCompany ? [] : [{ key: 'code', label: 'Código', placeholder: 'Ej: D-01' }]),
                form.isCompany
                  ? { key: 'phone', label: 'Celular de la empresa', placeholder: 'Ej: 3001234567' }
                  : { key: 'phone', label: 'Número de celular', placeholder: 'Ej: 3001234567' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: 'var(--t-text-3)', textTransform: 'uppercase', marginBottom: 6 }}>
                    {label}
                  </label>
                  <input
                    type={key === 'phone' ? 'tel' : 'text'}
                    value={form[key as 'name' | 'code' | 'phone']}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ width: '100%', border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: sg, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              {formError && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{formError}</p>}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={cancelForm} style={{ flex: 1, padding: '10px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', fontFamily: sg, fontWeight: 600, fontSize: 14, color: 'var(--t-text-3)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isPending} style={{ flex: 2, padding: '10px', borderRadius: 999, border: 'none', background: '#FF6A1A', color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
                {isPending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--t-text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: 'var(--t-text-3)', textTransform: 'uppercase' }}>
            Domiciliarios ({drivers.length})
          </span>
        </div>

        {drivers.length === 0 ? (
          <div style={{ border: '2px dashed var(--t-border)', borderRadius: 16, padding: '40px 20px', textAlign: 'center', background: 'var(--t-surface-2)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛵</div>
            <p style={{ fontFamily: sg, fontWeight: 700, fontSize: 15, color: 'var(--t-text-1)', margin: '0 0 6px' }}>
              Sin domiciliarios registrados
            </p>
            <p style={{ fontFamily: sg, fontSize: 13, color: 'var(--t-text-3)', margin: '0 0 16px' }}>
              Agregá tu personal de entrega para asignarlos a los pedidos
            </p>
            <button onClick={openAdd} style={{ fontFamily: sg, fontWeight: 700, fontSize: 13, color: '#FF6A1A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 999 }}>
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
  const sg = "var(--font-sans, sans-serif)";
  const sm = "var(--font-mono, monospace)";

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--t-surface)', border: '1px solid var(--t-border-2)', borderRadius: 14, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
      {/* Avatar */}
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#FFF3EA', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {driver.isCompany ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FF6A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FF6A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: sg, fontWeight: 700, fontSize: 14, color: 'var(--t-text-1)' }}>{driver.name}</span>
          {driver.isCompany ? (
            <span style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, color: '#4f46e5', background: '#eef2ff', padding: '2px 8px', borderRadius: 999 }}>Empresa</span>
          ) : driver.code ? (
            <span style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, color: '#FF6A1A', background: '#FFF3EA', padding: '2px 8px', borderRadius: 999 }}>{driver.code}</span>
          ) : null}
        </div>
        <span style={{ fontFamily: sg, fontSize: 12, color: 'var(--t-text-3)' }}>{driver.phone}</span>
      </div>

      {/* Estado */}
      <span style={{ padding: '4px 10px', borderRadius: 999, fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', background: driver.isActive ? '#d1fae5' : 'var(--t-surface-2)', color: driver.isActive ? '#059669' : 'var(--t-text-3)', flexShrink: 0 }}>
        {driver.isActive ? 'Activo' : 'Inactivo'}
      </span>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={() => onToggleActive(driver)} disabled={isToggling} title={driver.isActive ? 'Desactivar' : 'Activar'} style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'none', cursor: isToggling ? 'default' : 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)', opacity: isToggling ? 0.5 : 1 }}>
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

        <button onClick={() => onEdit(driver)} title="Editar" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)' }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>

        <button onClick={() => onDelete(driver)} disabled={isDeleting} title="Eliminar" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'none', cursor: isDeleting ? 'default' : 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)', opacity: isDeleting ? 0.5 : 1 }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
