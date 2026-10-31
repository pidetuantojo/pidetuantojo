'use client';

import { useState } from 'react';
import Link from 'next/link';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { useOrderStatuses } from '@/features/order-statuses/hooks/useOrderStatuses';
import { DEFAULT_TEMPLATES, statusNotifiesAny, statusTemplateChoice, WA_EVENTS, type WaEventCode } from '@/lib/whatsapp/templates.core';
import { useWaTemplates } from '@/lib/whatsapp/useWaTemplates';
import { useConfirmStore } from '@/store/confirm.store';
import { useToastStore } from '@/store/toast.store';
import type { OrderStatus } from '@/types';

import { TemplateEditor } from '../TemplateEditor';

// Qué se está editando: una del sistema, una propia o una nueva
type Editing = { kind: 'system'; code: WaEventCode } | { kind: 'custom'; id?: string; createdAt?: string };

const card: React.CSSProperties = { background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 16, padding: 20 };
const ghostBtn: React.CSSProperties = { padding: '7px 16px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'transparent', color: 'var(--t-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 };
const primaryBtn: React.CSSProperties = { padding: '8px 18px', borderRadius: 999, border: 'none', background: '#FF6A1A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const sectionTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--t-text-3)', margin: 0, letterSpacing: '.05em', textTransform: 'uppercase' };

function UsedBy({ statuses, extra }: { statuses: OrderStatus[]; extra?: string }) {
  const names = [...statuses.map((s) => s.name), ...(extra ? [extra] : [])];
  return (
    <p style={{ fontSize: 12, color: names.length ? 'var(--t-text-2)' : 'var(--t-text-4)', margin: '6px 0 0' }}>
      {names.length ? <>Se envía en: <strong>{names.join(', ')}</strong></> : 'No está asignada a ningún estado'}
    </p>
  );
}

function Snippet({ body }: { body: string }) {
  return (
    <div style={{ marginTop: 12, background: 'var(--t-surface-2)', borderRadius: 10, padding: '10px 14px' }}>
      <pre style={{ margin: 0, fontSize: 12, color: 'var(--t-text-3)', fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{body}</pre>
    </div>
  );
}

/** Plantillas de WhatsApp: las del sistema y las propias del restaurante. */
export function WaTemplatesManager() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';
  const { store, isLoading, saveSystem, saveCustom, removeCustom } = useWaTemplates(restaurantId);
  const { data: statuses = [] } = useOrderStatuses(restaurantId);
  const { showConfirm } = useConfirmStore();
  const { showToast } = useToastStore();

  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Estados que avisan en algún método de entrega con esta plantilla
  const usedBy = (id: string) => statuses.filter((s) => statusNotifiesAny(s) && statusTemplateChoice(s) === id);
  const saving = saveSystem.isPending || saveCustom.isPending;

  function open(next: Editing, body: string, templateName = '') {
    setEditing(next);
    setDraft(body);
    setName(templateName);
    setError('');
  }

  async function handleSave() {
    if (!editing) return;
    if (!draft.trim()) { setError('Escribe el mensaje'); return; }
    try {
      if (editing.kind === 'system') {
        await saveSystem.mutateAsync({ code: editing.code, body: draft });
      } else {
        if (!name.trim()) { setError('Ponle un nombre a la plantilla'); return; }
        await saveCustom.mutateAsync({ id: editing.id, name: name.trim(), body: draft, createdAt: editing.createdAt });
      }
      showToast(editing.kind === 'custom' && !editing.id ? 'Plantilla creada' : 'Plantilla guardada');
      setEditing(null);
    } catch {
      setError('No se pudo guardar. Revisa que tengas permiso e intenta de nuevo.');
    }
  }

  async function handleDelete(id: string, templateName: string) {
    const users = usedBy(id);
    if (users.length) {
      showToast(`La usa: ${users.map((s) => s.name).join(', ')}. Cámbiale la plantilla a ese estado primero.`, 'error');
      return;
    }
    if (!await showConfirm({ message: `¿Eliminar la plantilla "${templateName}"? No se puede deshacer.` })) return;
    try {
      await removeCustom.mutateAsync(id);
      showToast('Plantilla eliminada');
    } catch {
      showToast('No se pudo eliminar la plantilla', 'error');
    }
  }

  if (isLoading || !store) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid #FF6A1A', borderTopColor: 'transparent', animation: 'spin .8s linear infinite', display: 'block' }} />
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
      </div>
    );
  }

  const editorBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      {editing?.kind === 'custom' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-2)' }}>Nombre de la plantilla</span>
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Pedido empacado"
            style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--t-border)', background: 'var(--t-surface-2)', fontSize: 14, color: 'var(--t-text-1)', outline: 'none' }}
          />
        </label>
      )}
      <TemplateEditor value={draft} onChange={setDraft} />
      {error && <p role="alert" style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {editing?.kind === 'system' ? (
          <button type="button" onClick={() => setDraft(DEFAULT_TEMPLATES[editing.code])} style={{ fontSize: 12, color: 'var(--t-text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
            Restaurar por defecto
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setEditing(null)} style={ghostBtn}>Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );

  const creatingNew = editing?.kind === 'custom' && !editing.id;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t-text-1)', margin: '0 0 6px' }}>Plantillas de WhatsApp</h1>
        <p style={{ fontSize: 14, color: 'var(--t-text-3)', margin: 0 }}>
          El mensaje que recibe el cliente cuando su pedido cambia de estado. Para elegir qué plantilla usa cada estado, o apagar el aviso,
          ve a <Link href={ROUTES.dashboard.estados} style={{ color: '#FF6A1A', fontWeight: 600 }}>Estados</Link>.
        </p>
      </div>

      {/* Mis plantillas */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={sectionTitle}>Mis plantillas</p>
          {!creatingNew && (
            <button type="button" onClick={() => open({ kind: 'custom' }, '')} style={primaryBtn}>+ Nueva plantilla</button>
          )}
        </div>

        {creatingNew && (
          <div style={{ ...card, borderColor: '#FF6A1A' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t-text-1)' }}>Nueva plantilla</span>
            {editorBlock}
          </div>
        )}

        {store.custom.length === 0 && !creatingNew && (
          <div style={{ ...card, borderStyle: 'dashed', textAlign: 'center', color: 'var(--t-text-3)', fontSize: 14 }}>
            Todavía no tienes plantillas propias. Crea una para tus estados personalizados (por ejemplo “Pedido empacado”).
          </div>
        )}

        {store.custom.map((t) => {
          const isEditing = editing?.kind === 'custom' && editing.id === t.id;
          return (
            <div key={t.id} style={{ ...card, borderColor: isEditing ? '#FF6A1A' : 'var(--t-border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t-text-1)' }}>✨ {t.name}</span>
                  <UsedBy statuses={usedBy(t.id)} />
                </div>
                {!isEditing && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => open({ kind: 'custom', id: t.id, createdAt: t.createdAt }, t.body, t.name)} style={ghostBtn}>Editar</button>
                    <button type="button" onClick={() => handleDelete(t.id, t.name)} style={{ ...ghostBtn, color: '#ef4444', borderColor: '#fecaca' }}>Eliminar</button>
                  </div>
                )}
              </div>
              {isEditing ? editorBlock : <Snippet body={t.body} />}
            </div>
          );
        })}
      </section>

      {/* Plantillas del sistema */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={sectionTitle}>Plantillas del sistema</p>
        {WA_EVENTS.map((event) => {
          const isEditing = editing?.kind === 'system' && editing.code === event.code;
          return (
            <div key={event.code} style={{ ...card, borderColor: isEditing ? '#FF6A1A' : 'var(--t-border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t-text-1)' }}>{event.emoji} {event.label}</span>
                  <UsedBy statuses={usedBy(event.code)} extra={event.code === 'pedido_pagado' ? 'Al marcar como pagado' : undefined} />
                </div>
                {!isEditing && (
                  <button type="button" onClick={() => open({ kind: 'system', code: event.code }, store.system[event.code])} style={ghostBtn}>Editar</button>
                )}
              </div>
              {isEditing ? editorBlock : <Snippet body={store.system[event.code]} />}
            </div>
          );
        })}
      </section>
    </div>
  );
}
