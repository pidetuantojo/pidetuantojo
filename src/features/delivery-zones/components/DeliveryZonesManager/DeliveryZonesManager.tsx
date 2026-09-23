'use client';

import { useState } from 'react';

import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/features/auth';
import type { DeliveryZone } from '@/types';

import { useDeliveryZones } from '../../hooks/useDeliveryZones';
import {
  useCreateDeliveryZone,
  useUpdateDeliveryZone,
  useDeleteDeliveryZone,
} from '../../hooks/useDeliveryZoneMutations';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

const COLOR_PRIMARY = '#FF6A1A';
const COLOR_BG = '#FBF8F5';
const COLOR_BORDER = '#EFE7DF';
const COLOR_DARK = '#1B1512';
const COLOR_MUTED = '#9a8f86';

interface ZoneFormState {
  name: string;
  price: string;
}

const emptyForm: ZoneFormState = { name: '', price: '' };

export function DeliveryZonesManager() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  const { data: zones = [], isLoading: zonesLoading, error } = useDeliveryZones(restaurantId || undefined);

  const createZone = useCreateDeliveryZone(restaurantId);
  const updateZone = useUpdateDeliveryZone(restaurantId);
  const deleteZone = useDeleteDeliveryZone(restaurantId);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | undefined>(undefined);
  const [form, setForm] = useState<ZoneFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditing(undefined);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(zone: DeliveryZone) {
    setEditing(zone);
    setForm({ name: zone.name, price: String(zone.price) });
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
    const price = parseFloat(form.price);
    if (!name) { setFormError('El nombre es requerido'); return; }
    if (isNaN(price) || price < 0) { setFormError('Ingresá un precio válido'); return; }

    setFormError('');
    if (editing) {
      await updateZone.mutateAsync({ id: editing.id, data: { name, price } });
    } else {
      await createZone.mutateAsync({
        restaurantId,
        name,
        price,
        isActive: true,
        sortOrder: zones.length + 1,
      });
    }
    cancelForm();
  }

  async function handleToggleActive(zone: DeliveryZone) {
    setTogglingId(zone.id);
    try {
      await updateZone.mutateAsync({ id: zone.id, data: { isActive: !zone.isActive } });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(zone: DeliveryZone) {
    if (!confirm(`¿Eliminar la zona "${zone.name}"?`)) return;
    setDeletingId(zone.id);
    try {
      await deleteZone.mutateAsync(zone.id);
    } finally {
      setDeletingId(null);
    }
  }

  if (!restaurantId) {
    return (
      <p style={{ fontFamily: sg, fontSize: 14, color: '#ef4444' }}>
        Tu cuenta no tiene un restaurante asignado.
      </p>
    );
  }

  if (zonesLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid #FF6A1A', borderTopColor: 'transparent', display: 'block', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontFamily: sg, fontSize: 14, color: '#b91c1c' }}>
        Error al cargar las zonas de domicilio.
      </div>
    );
  }

  const isPending = createZone.isPending || updateZone.isPending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: sg }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: COLOR_DARK, letterSpacing: '-.02em' }}>
            Zonas de domicilio
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: COLOR_MUTED }}>
            Definí los barrios o sectores con su precio de envío
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 999, border: 'none',
            background: COLOR_PRIMARY, color: '#fff',
            fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva zona
        </button>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <section style={{ background: '#fff', border: `1.5px solid ${COLOR_PRIMARY}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: COLOR_DARK }}>
            {editing ? `Editar zona: ${editing.name}` : 'Nueva zona'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: COLOR_MUTED, textTransform: 'uppercase', marginBottom: 6 }}>
                Nombre del sector / barrio
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Centro, Laureles, Envigado..."
                style={{
                  width: '100%', border: `1.5px solid ${COLOR_BORDER}`, borderRadius: 10,
                  padding: '10px 12px', fontSize: 14, fontFamily: sg, color: COLOR_DARK,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: COLOR_MUTED, textTransform: 'uppercase', marginBottom: 6 }}>
                Precio del domicilio ($)
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                placeholder="Ej: 5000"
                min="0"
                style={{
                  width: '100%', border: `1.5px solid ${COLOR_BORDER}`, borderRadius: 10,
                  padding: '10px 12px', fontSize: 14, fontFamily: sg, color: COLOR_DARK,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {formError && (
              <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{formError}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={cancelForm}
                style={{
                  flex: 1, padding: '10px', borderRadius: 999,
                  border: `1.5px solid ${COLOR_BORDER}`, background: '#fff',
                  fontFamily: sg, fontWeight: 600, fontSize: 14, color: COLOR_MUTED,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                style={{
                  flex: 2, padding: '10px', borderRadius: 999, border: 'none',
                  background: COLOR_PRIMARY, color: '#fff',
                  fontFamily: sg, fontWeight: 700, fontSize: 14,
                  cursor: isPending ? 'default' : 'pointer',
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Agregar zona')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Lista de zonas */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={COLOR_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
          </svg>
          <span style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: COLOR_MUTED, textTransform: 'uppercase' }}>
            Zonas configuradas ({zones.length})
          </span>
        </div>

        {zones.length === 0 ? (
          <div style={{
            border: `2px dashed ${COLOR_BORDER}`, borderRadius: 16,
            padding: '40px 20px', textAlign: 'center',
            background: COLOR_BG,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗺️</div>
            <p style={{ fontFamily: sg, fontWeight: 700, fontSize: 15, color: COLOR_DARK, margin: '0 0 6px' }}>
              Todavía no hay zonas configuradas
            </p>
            <p style={{ fontFamily: sg, fontSize: 13, color: COLOR_MUTED, margin: '0 0 16px' }}>
              Agregá barrios o sectores con su precio de envío correspondiente
            </p>
            <button
              onClick={openAdd}
              style={{
                fontFamily: sg, fontWeight: 700, fontSize: 13, color: COLOR_PRIMARY,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 999,
              }}
            >
              + Agregar primera zona
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {zones.map((zone) => (
              <ZoneRow
                key={zone.id}
                zone={zone}
                onEdit={openEdit}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
                isToggling={togglingId === zone.id}
                isDeleting={deletingId === zone.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface ZoneRowProps {
  zone: DeliveryZone;
  onEdit: (zone: DeliveryZone) => void;
  onToggleActive: (zone: DeliveryZone) => void;
  onDelete: (zone: DeliveryZone) => void;
  isToggling?: boolean;
  isDeleting?: boolean;
}

function ZoneRow({ zone, onEdit, onToggleActive, onDelete, isToggling, isDeleting }: ZoneRowProps) {
  const sg = "var(--font-sans, sans-serif)";
  const sm = "var(--font-mono, monospace)";

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: '#fff', border: `1px solid #EFE7DF`,
      borderRadius: 14, padding: '12px 16px',
      boxShadow: '0 1px 4px rgba(0,0,0,.04)',
    }}>
      {/* Sort order */}
      <span style={{ fontFamily: sm, fontSize: 11, color: '#9a8f86', minWidth: 18, textAlign: 'center' }}>
        {zone.sortOrder}
      </span>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: sg, fontWeight: 700, fontSize: 14, color: '#1B1512' }}>
          {zone.name}
        </div>
        <div style={{ fontFamily: sg, fontWeight: 800, fontSize: 13, color: '#FF6A1A', marginTop: 1 }}>
          {formatCurrency(zone.price)}
        </div>
      </div>

      {/* Estado badge */}
      <span style={{
        padding: '4px 10px', borderRadius: 999,
        fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
        background: zone.isActive ? '#d1fae5' : '#f3f4f6',
        color: zone.isActive ? '#059669' : '#6b7280',
      }}>
        {zone.isActive ? 'Activa' : 'Inactiva'}
      </span>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {/* Toggle activo */}
        <button
          onClick={() => onToggleActive(zone)}
          disabled={isToggling}
          title={zone.isActive ? 'Desactivar' : 'Activar'}
          style={{
            width: 32, height: 32, borderRadius: 999, border: 'none', background: 'none',
            cursor: isToggling ? 'default' : 'pointer', display: 'grid', placeItems: 'center',
            color: '#9a8f86', opacity: isToggling ? 0.5 : 1,
          }}
        >
          {zone.isActive ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>

        {/* Editar */}
        <button
          onClick={() => onEdit(zone)}
          title="Editar"
          style={{
            width: 32, height: 32, borderRadius: 999, border: 'none', background: 'none',
            cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#9a8f86',
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>

        {/* Eliminar */}
        <button
          onClick={() => onDelete(zone)}
          disabled={isDeleting}
          title="Eliminar"
          style={{
            width: 32, height: 32, borderRadius: 999, border: 'none', background: 'none',
            cursor: isDeleting ? 'default' : 'pointer', display: 'grid', placeItems: 'center',
            color: '#9a8f86', opacity: isDeleting ? 0.5 : 1,
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
