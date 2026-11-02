'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { DEFAULT_TEMPLATES, WA_EVENTS, type WaEventCode } from '@/lib/whatsapp/templates.core';
import { useWaTemplates } from '@/lib/whatsapp/useWaTemplates';
import { useToastStore } from '@/store/toast.store';

import { TemplateEditor } from '../TemplateEditor';

const card: React.CSSProperties = { background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 16, padding: 24 };
const ghostBtn: React.CSSProperties = { padding: '8px 18px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'transparent', color: 'var(--t-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const primaryBtn: React.CSSProperties = { padding: '8px 20px', borderRadius: 999, border: 'none', background: '#FF6A1A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };

const isSystemCode = (id: string): id is WaEventCode => WA_EVENTS.some((e) => e.code === id);

/**
 * Vista para crear o editar una plantilla.
 * Sin `templateId`: nueva plantilla propia. Con un código del sistema: esa plantilla. Con otro id: una propia.
 */
export function WaTemplateForm({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';
  const { store, isLoading, saveSystem, saveCustom } = useWaTemplates(restaurantId);
  const { showToast } = useToastStore();

  const systemCode = templateId && isSystemCode(templateId) ? templateId : null;
  const custom = templateId && !systemCode ? store?.custom.find((t) => t.id === templateId) : undefined;
  const event = systemCode ? WA_EVENTS.find((e) => e.code === systemCode) : undefined;
  const notFound = !!templateId && !systemCode && !!store && !custom;

  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(!templateId);

  // Carga el texto actual una sola vez, cuando llegan las plantillas
  useEffect(() => {
    if (loaded || !store) return;
    if (systemCode) setDraft(store.system[systemCode]);
    else if (custom) { setDraft(custom.body); setName(custom.name); }
    setLoaded(true);
  }, [loaded, store, systemCode, custom]);

  const saving = saveSystem.isPending || saveCustom.isPending;
  const goBack = () => router.push(ROUTES.dashboard.notificaciones.plantillas);

  async function handleSave() {
    if (!draft.trim()) { setError('Escribe el mensaje'); return; }
    if (!systemCode && !name.trim()) { setError('Ponle un nombre a la plantilla'); return; }
    try {
      if (systemCode) await saveSystem.mutateAsync({ code: systemCode, body: draft });
      else await saveCustom.mutateAsync({ id: custom?.id, name: name.trim(), body: draft, createdAt: custom?.createdAt });
      showToast(templateId ? 'Plantilla guardada' : 'Plantilla creada');
      goBack();
    } catch {
      setError('No se pudo guardar. Revisa que tengas permiso e intenta de nuevo.');
    }
  }

  const title = systemCode ? `${event?.emoji} ${event?.label}` : custom ? `Editar: ${custom.name}` : 'Nueva plantilla';
  const subtitle = systemCode
    ? 'Plantilla del sistema. Si la dejas igual a la por defecto, se mantiene al día con nuestras mejoras.'
    : 'Crea un mensaje propio y asígnalo a tus estados personalizados desde Estados.';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button" onClick={goBack} aria-label="Volver a plantillas"
          style={{ width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 12, border: '1px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text-3)', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t-text-1)', margin: '0 0 2px' }}>{title}</h1>
          <p style={{ fontSize: 14, color: 'var(--t-text-3)', margin: 0 }}>{subtitle}</p>
        </div>
      </div>

      {isLoading || !loaded ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <span style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid #FF6A1A', borderTopColor: 'transparent', animation: 'spin .8s linear infinite', display: 'block' }} />
          <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
        </div>
      ) : notFound ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--t-text-3)', fontSize: 14 }}>
          Esta plantilla no existe o fue eliminada.
          <div style={{ marginTop: 16 }}><button type="button" onClick={goBack} style={ghostBtn}>Volver a plantillas</button></div>
        </div>
      ) : (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!systemCode && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-2)' }}>Nombre de la plantilla</span>
              <input
                value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Pedido empacado" autoFocus={!templateId}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--t-border)', background: 'var(--t-surface-2)', fontSize: 14, color: 'var(--t-text-1)', outline: 'none' }}
              />
            </label>
          )}
          <TemplateEditor value={draft} onChange={setDraft} />
          {error && <p role="alert" style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            {systemCode ? (
              <button type="button" onClick={() => setDraft(DEFAULT_TEMPLATES[systemCode])} style={{ fontSize: 12, color: 'var(--t-text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
                Restaurar por defecto
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={goBack} style={ghostBtn}>Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Guardando...' : templateId ? 'Guardar' : 'Crear plantilla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
