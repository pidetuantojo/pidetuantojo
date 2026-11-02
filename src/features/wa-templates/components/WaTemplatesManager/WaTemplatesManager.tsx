'use client';

import Link from 'next/link';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { useOrderStatuses } from '@/features/order-statuses/hooks/useOrderStatuses';
import { DEFAULT_TEMPLATES, statusNotifiesAny, statusTemplateChoice, WA_EVENTS } from '@/lib/whatsapp/templates.core';
import { useWaTemplates } from '@/lib/whatsapp/useWaTemplates';
import { useConfirmStore } from '@/store/confirm.store';
import { useToastStore } from '@/store/toast.store';
import type { OrderStatus } from '@/types';

const badge = (custom: boolean): React.CSSProperties => ({
  fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', borderRadius: 999, padding: '2px 8px', marginLeft: 8,
  background: custom ? 'rgba(255,106,26,.1)' : 'var(--t-surface-2)', color: custom ? '#FF6A1A' : 'var(--t-text-3)',
});

const card: React.CSSProperties = { background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 16, padding: 20 };
const ghostBtn: React.CSSProperties = { padding: '7px 16px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'transparent', color: 'var(--t-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, textDecoration: 'none' };
const primaryBtn: React.CSSProperties = { padding: '8px 18px', borderRadius: 999, border: 'none', background: '#FF6A1A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' };
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

/** Plantillas de WhatsApp: las del sistema y las propias del restaurante. Crear y editar se hace en su propia vista. */
export function WaTemplatesManager() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';
  const { store, isLoading, removeCustom } = useWaTemplates(restaurantId);
  const { data: statuses = [] } = useOrderStatuses(restaurantId);
  const { showConfirm } = useConfirmStore();
  const { showToast } = useToastStore();

  // Estados que avisan en algún método de entrega con esta plantilla
  const usedBy = (id: string) => statuses.filter((s) => statusNotifiesAny(s) && statusTemplateChoice(s) === id);

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

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t-text-1)', margin: '0 0 6px' }}>Plantillas de WhatsApp</h1>
        <p style={{ fontSize: 14, color: 'var(--t-text-3)', margin: 0 }}>
          El mensaje que recibe el cliente cuando su pedido cambia de estado. Los cambios son solo de tu restaurante.
          Las plantillas que no edites se mantienen al día con las mejoras que hagamos. Para elegir qué plantilla usa cada estado, o apagar el aviso,
          ve a <Link href={ROUTES.dashboard.estados} style={{ color: '#FF6A1A', fontWeight: 600 }}>Estados</Link>.
        </p>
      </div>

      {/* Mis plantillas */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={sectionTitle}>Mis plantillas</p>
          <Link href={ROUTES.dashboard.notificaciones.plantillaNueva} style={primaryBtn}>+ Nueva plantilla</Link>
        </div>

        {store.custom.length === 0 && (
          <div style={{ ...card, borderStyle: 'dashed', textAlign: 'center', color: 'var(--t-text-3)', fontSize: 14 }}>
            Todavía no tienes plantillas propias. Crea una para tus estados personalizados (por ejemplo “Pedido empacado”).
          </div>
        )}

        {store.custom.map((t) => (
          <div key={t.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t-text-1)' }}>✨ {t.name}</span>
                <UsedBy statuses={usedBy(t.id)} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Link href={ROUTES.dashboard.notificaciones.plantilla(t.id)} style={ghostBtn}>Editar</Link>
                <button type="button" onClick={() => handleDelete(t.id, t.name)} style={{ ...ghostBtn, color: '#ef4444', borderColor: '#fecaca' }}>Eliminar</button>
              </div>
            </div>
            <Snippet body={t.body} />
          </div>
        ))}
      </section>

      {/* Plantillas del sistema */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={sectionTitle}>Plantillas del sistema</p>
        {WA_EVENTS.map((event) => {
          // parseTemplateStore ya descarta lo guardado igual al por defecto (actual o viejo)
          const customized = store.system[event.code] !== DEFAULT_TEMPLATES[event.code];
          return (
            <div key={event.code} style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t-text-1)' }}>{event.emoji} {event.label}</span>
                  <span style={badge(customized)}>{customized ? 'Personalizada' : 'Por defecto'}</span>
                  <UsedBy statuses={usedBy(event.code)} extra={event.code === 'pedido_pagado' ? 'Al marcar como pagado' : undefined} />
                </div>
                <Link href={ROUTES.dashboard.notificaciones.plantilla(event.code)} style={ghostBtn}>Editar</Link>
              </div>
              <Snippet body={store.system[event.code]} />
            </div>
          );
        })}
      </section>
    </div>
  );
}
