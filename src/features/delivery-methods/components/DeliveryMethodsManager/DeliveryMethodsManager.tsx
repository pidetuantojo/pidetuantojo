'use client';

import { useState } from 'react';

import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { useUpdateRestaurant } from '@/features/restaurants/hooks/useRestaurantMutations';
import type { DeliveryMethods, Mesa } from '@/types';

import { useMesas } from '../../hooks/useMesas';
import { useCreateMesa, useUpdateMesa, useDeleteMesa } from '../../hooks/useMesaMutations';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IcoRecoger() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h18M9 9V5a3 3 0 0 1 6 0v4M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
    </svg>
  );
}
function IcoDomicilio() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
    </svg>
  );
}
function IcoMesa() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M8 18h8M12 6v12" />
    </svg>
  );
}
function IcoClock() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 999, border: 'none',
        background: checked ? '#FF6A1A' : 'var(--t-border)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', flexShrink: 0,
        transition: 'background .2s', opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)',
        transition: 'left .2s',
      }} />
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DeliveryMethodsManager() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  const { data: restaurant, isLoading } = useRestaurant(restaurantId || undefined);
  const updateRestaurant = useUpdateRestaurant();

  const { data: mesas = [], isLoading: mesasLoading } = useMesas(restaurantId || undefined);
  const createMesa = useCreateMesa(restaurantId);
  const updateMesa = useUpdateMesa(restaurantId);
  const deleteMesa = useDeleteMesa(restaurantId);

  // Mesa form modal
  const [mesaModal, setMesaModal] = useState<{ open: boolean; editing?: Mesa }>({ open: false });
  const [mesaName, setMesaName] = useState('');
  const [mesaError, setMesaError] = useState('');

  if (!restaurantId) return null;
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', border: '4px solid #FF6A1A', borderTopColor: 'transparent', display: 'block', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  const methods: DeliveryMethods = restaurant?.deliveryMethods ?? {};

  // Compute active count for validation
  const activeCount = [
    methods.recoger?.isActive ?? true,
    methods.domicilio?.isActive ?? true,
    methods.mesa?.isActive ?? false,
  ].filter(Boolean).length;

  async function toggleMethod(key: keyof DeliveryMethods, value: boolean) {
    if (!value && activeCount <= 1) return; // block if last active

    const current = methods[key] ?? {};
    const updated: DeliveryMethods = {
      ...methods,
      [key]: { ...current, isActive: value },
    };
    await updateRestaurant.mutateAsync({ id: restaurantId, data: { deliveryMethods: updated } });
  }

  async function toggleScheduled(key: 'recoger' | 'domicilio', value: boolean) {
    const current = methods[key] ?? {};
    const updated: DeliveryMethods = {
      ...methods,
      [key]: { ...current, allowScheduled: value },
    };
    await updateRestaurant.mutateAsync({ id: restaurantId, data: { deliveryMethods: updated } });
  }

  function openMesaModal(mesa?: Mesa) {
    setMesaModal({ open: true, editing: mesa });
    setMesaName(mesa?.name ?? '');
    setMesaError('');
  }

  function closeMesaModal() {
    setMesaModal({ open: false });
    setMesaName('');
    setMesaError('');
  }

  async function handleSaveMesa() {
    const name = mesaName.trim();
    if (!name) { setMesaError('El nombre es requerido'); return; }
    setMesaError('');
    if (mesaModal.editing) {
      await updateMesa.mutateAsync({ id: mesaModal.editing.id, data: { name } });
    } else {
      await createMesa.mutateAsync({ restaurantId, name, isActive: true, sortOrder: mesas.length + 1 });
    }
    closeMesaModal();
  }

  async function handleDeleteMesa(mesa: Mesa) {
    if (!confirm(`¿Eliminar "${mesa.name}"?`)) return;
    await deleteMesa.mutateAsync(mesa.id);
  }

  const isSaving = updateRestaurant.isPending;

  const METHOD_DEFS = [
    {
      key: 'recoger' as const,
      label: 'Recoger en Local',
      desc: 'El cliente retira el pedido en tu local.',
      icon: <IcoRecoger />,
      isActive: methods.recoger?.isActive ?? true,
      allowScheduled: methods.recoger?.allowScheduled ?? false,
      showScheduled: true,
    },
    {
      key: 'domicilio' as const,
      label: 'Domicilio',
      desc: 'Envías el pedido a la dirección del cliente.',
      icon: <IcoDomicilio />,
      isActive: methods.domicilio?.isActive ?? true,
      allowScheduled: methods.domicilio?.allowScheduled ?? false,
      showScheduled: true,
    },
    {
      key: 'mesa' as const,
      label: 'Comer en el Local',
      desc: 'El cliente pide desde su mesa.',
      icon: <IcoMesa />,
      isActive: methods.mesa?.isActive ?? false,
      showScheduled: false,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: sg }}>

      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>
          Métodos de entrega
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--t-text-3)' }}>
          Activa o desactiva los métodos disponibles para tus clientes. Al menos uno debe quedar activo.
        </p>
      </div>

      {/* Method cards */}
      {METHOD_DEFS.map((method) => {
        const isLastActive = method.isActive && activeCount === 1;
        return (
          <div
            key={method.key}
            style={{
              background: 'var(--t-surface)',
              border: `1.5px solid ${method.isActive ? '#FF6A1A44' : 'var(--t-border-2)'}`,
              borderRadius: 18,
              overflow: 'hidden',
              opacity: isSaving ? 0.7 : 1,
              transition: 'border-color .2s, opacity .2s',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: method.isActive ? '#FFF3EA' : 'var(--t-surface-2)',
                display: 'grid', placeItems: 'center',
                color: method.isActive ? '#FF6A1A' : 'var(--t-text-3)',
                transition: 'background .2s, color .2s',
              }}>
                {method.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t-text-1)' }}>{method.label}</div>
                <div style={{ fontSize: 13, color: 'var(--t-text-3)', marginTop: 2 }}>{method.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {isLastActive && (
                  <span style={{ fontFamily: sm, fontSize: 10, color: '#FF6A1A', background: '#FFF3EA', padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>
                    mín. 1
                  </span>
                )}
                <Toggle
                  checked={method.isActive}
                  onChange={(v) => toggleMethod(method.key, v)}
                  disabled={isSaving || isLastActive}
                />
              </div>
            </div>

            {/* Expanded section */}
            {method.isActive && (
              <div style={{ borderTop: '1px solid var(--t-border-2)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Programar pedido */}
                {method.showScheduled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--t-surface-2)', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)', flexShrink: 0 }}>
                      <IcoClock />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--t-text-1)' }}>Programar pedido</div>
                      <div style={{ fontSize: 12, color: 'var(--t-text-3)' }}>El cliente puede elegir cuándo recibir su pedido</div>
                    </div>
                    <Toggle
                      checked={(method as typeof METHOD_DEFS[0]).allowScheduled ?? false}
                      onChange={(v) => toggleScheduled(method.key as 'recoger' | 'domicilio', v)}
                      disabled={isSaving}
                    />
                  </div>
                )}

                {/* Mesa management */}
                {method.key === 'mesa' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--t-text-3)', textTransform: 'uppercase' }}>
                        Mesas ({mesas.length})
                      </span>
                      <button
                        onClick={() => openMesaModal()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, border: 'none', background: '#FF6A1A', color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Agregar mesa
                      </button>
                    </div>

                    {mesasLoading ? (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--t-text-3)', fontSize: 13 }}>Cargando...</div>
                    ) : mesas.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t-text-3)', fontSize: 13 }}>
                        Sin mesas configuradas. Agrega las mesas de tu local.
                        <div style={{ marginTop: 6, fontSize: 12, color: '#FF6A1A', fontWeight: 600 }}>
                          Mientras no haya mesas, tus clientes podrán pedir sin elegir mesa y se les indicará que pregunten al mesero.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {mesas.map((mesa) => (
                          <div key={mesa.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--t-surface-2)', borderRadius: 10, padding: '10px 14px' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF3EA', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <IcoMesa />
                            </div>
                            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--t-text-1)' }}>{mesa.name}</span>
                            <button onClick={() => openMesaModal(mesa)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)' }}>
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </button>
                            <button onClick={() => handleDeleteMesa(mesa)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)' }}>
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Mesa modal */}
      {mesaModal.open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeMesaModal(); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div style={{ background: 'var(--t-surface)', borderRadius: 20, padding: '24px 28px', width: 400, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--t-text-1)' }}>
                {mesaModal.editing ? `Editar: ${mesaModal.editing.name}` : 'Nueva mesa'}
              </h3>
              <button onClick={closeMesaModal} style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'var(--t-surface-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)', fontSize: 16 }}>✕</button>
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: 'var(--t-text-3)', textTransform: 'uppercase', marginBottom: 6 }}>
                Nombre de la mesa
              </label>
              <input
                type="text"
                value={mesaName}
                onChange={(e) => setMesaName(e.target.value)}
                placeholder="Ej: Mesa 1, Mesa VIP, Terraza..."
                style={{ width: '100%', border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: sg, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }}
              />
              {mesaError && <p style={{ fontSize: 12, color: '#ef4444', margin: '4px 0 0' }}>{mesaError}</p>}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeMesaModal} style={{ flex: 1, padding: '10px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', fontFamily: sg, fontWeight: 600, fontSize: 14, color: 'var(--t-text-3)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={handleSaveMesa}
                disabled={createMesa.isPending || updateMesa.isPending}
                style={{ flex: 2, padding: '10px', borderRadius: 999, border: 'none', background: '#FF6A1A', color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (createMesa.isPending || updateMesa.isPending) ? 0.7 : 1 }}
              >
                {(createMesa.isPending || updateMesa.isPending) ? 'Guardando...' : mesaModal.editing ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
