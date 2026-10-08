'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth';
import {
  WA_EVENTS,
  TEMPLATE_VARS,
  DEFAULT_TEMPLATES,
  getWaTemplates,
  saveWaTemplates,
  applyTemplate,
} from '@/lib/whatsapp/templates';
import type { WaEventCode, WaTemplates } from '@/lib/whatsapp/templates';

const EXAMPLE_DATA = {
  customerName: 'Juan García',
  orderNumber: '#1042',
  total: 45000,
  paymentMethod: 'Efectivo',
  items: [
    { productName: 'Hamburguesa clásica', quantity: 2 },
    { productName: 'Papas medianas', quantity: 1 },
  ],
};

export default function PlantillasPage() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  const [templates, setTemplates] = useState<WaTemplates>({ ...DEFAULT_TEMPLATES });
  const [editing, setEditing] = useState<WaEventCode | null>(null);
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    getWaTemplates(restaurantId)
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, [restaurantId]);

  function startEdit(code: WaEventCode) {
    setEditing(code);
    setDraft(templates[code]);
    setPreview(false);
    setSaved(false);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft('');
    setPreview(false);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    const updated = { ...templates, [editing]: draft };
    try {
      await saveWaTemplates(restaurantId, { [editing]: draft });
      setTemplates(updated);
      setSaved(true);
      setTimeout(() => { setEditing(null); setSaved(false); }, 800);
    } finally {
      setSaving(false);
    }
  }

  function resetDefault(code: WaEventCode) {
    setDraft(DEFAULT_TEMPLATES[code]);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid #FF6A1A', borderTopColor: 'transparent', animation: 'spin .8s linear infinite', display: 'block' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t-text-1)', margin: '0 0 6px' }}>
          Plantillas de WhatsApp
        </h1>
        <p style={{ fontSize: 14, color: 'var(--t-text-3)', margin: 0 }}>
          Personalizá el mensaje que recibe el cliente cuando su pedido cambia de estado.
        </p>
      </div>

      {/* Variables disponibles */}
      <div style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 14, padding: '14px 18px', marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-3)', margin: '0 0 10px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
          Variables disponibles
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TEMPLATE_VARS.map((v) => (
            <span
              key={v.key}
              title={v.label}
              style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', background: 'var(--t-surface-2)', border: '1px solid var(--t-border)', borderRadius: 6, padding: '3px 8px', color: 'var(--t-text-2)', cursor: 'default' }}
            >
              {v.key}
            </span>
          ))}
        </div>
      </div>

      {/* Cards de eventos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {WA_EVENTS.map((event) => {
          const isEditing = editing === event.code;
          return (
            <div
              key={event.code}
              style={{ background: 'var(--t-surface)', border: `1px solid ${isEditing ? '#FF6A1A' : 'var(--t-border)'}`, borderRadius: 16, padding: 20, transition: 'border-color .15s' }}
            >
              {/* Event header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: isEditing ? 16 : 0 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 18 }}>{event.emoji}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t-text-1)' }}>{event.label}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--t-text-3)', margin: 0 }}>{event.description}</p>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => startEdit(event.code)}
                    style={{ padding: '7px 16px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'transparent', color: 'var(--t-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Editar
                  </button>
                )}
              </div>

              {/* Preview collapsed */}
              {!isEditing && (
                <div style={{ marginTop: 12, background: 'var(--t-surface-2)', borderRadius: 10, padding: '10px 14px' }}>
                  <pre style={{ margin: 0, fontSize: 12, color: 'var(--t-text-3)', fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {templates[event.code]}
                  </pre>
                </div>
              )}

              {/* Editor */}
              {isEditing && (
                <>
                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--t-border)', paddingBottom: 12 }}>
                    <button
                      onClick={() => setPreview(false)}
                      style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: !preview ? '#FF6A1A' : 'transparent', color: !preview ? '#fff' : 'var(--t-text-3)' }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setPreview(true)}
                      style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: preview ? '#FF6A1A' : 'transparent', color: preview ? '#fff' : 'var(--t-text-3)' }}
                    >
                      Vista previa
                    </button>
                  </div>

                  {!preview ? (
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={7}
                      style={{ width: '100%', fontFamily: 'var(--font-mono, monospace)', fontSize: 13, color: 'var(--t-text-1)', background: 'var(--t-surface-2)', border: '1.5px solid var(--t-border)', borderRadius: 10, padding: '12px 14px', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
                      onFocus={(e) => { e.target.style.borderColor = '#FF6A1A'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'var(--t-border)'; }}
                    />
                  ) : (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', margin: '0 0 8px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                        Así recibirá el mensaje el cliente
                      </p>
                      <pre style={{ margin: 0, fontSize: 13, color: '#166534', fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {applyTemplate(draft, EXAMPLE_DATA)}
                      </pre>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
                    <button
                      onClick={() => resetDefault(event.code)}
                      style={{ fontSize: 12, color: 'var(--t-text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}
                    >
                      Restaurar por defecto
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={cancelEdit}
                        style={{ padding: '8px 18px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'transparent', color: 'var(--t-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{ padding: '8px 18px', borderRadius: 999, border: 'none', background: saved ? '#22c55e' : '#FF6A1A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'background .2s' }}
                      >
                        {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
