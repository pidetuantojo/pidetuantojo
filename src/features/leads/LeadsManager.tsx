'use client';

import { useState } from 'react';

import { useLeads, useUpdateLeadStatus } from './useLeads';
import type { RestaurantLead } from './leads.service';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_META: Record<RestaurantLead['status'], { label: string; bg: string; color: string }> = {
  pending:    { label: 'Pendiente',   bg: 'var(--t-badge-warn-bg)',  color: 'var(--t-badge-warn-text)' },
  contacted:  { label: 'Contactado',  bg: 'var(--t-badge-info-bg)',  color: 'var(--t-badge-info-text)' },
  active:     { label: 'Activo',      bg: 'var(--t-badge-ok-bg)',    color: 'var(--t-badge-ok-text)' },
};

const STATUS_CYCLE: Record<RestaurantLead['status'], RestaurantLead['status']> = {
  pending: 'contacted',
  contacted: 'active',
  active: 'pending',
};

// ─── lead card ───────────────────────────────────────────────────────────────

function LeadCard({ lead, onStatusChange }: { lead: RestaurantLead; onStatusChange: (id: string, status: RestaurantLead['status']) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[lead.status];

  return (
    <div style={{
      background: 'var(--t-surface)', borderRadius: 14, border: '1px solid var(--t-border-2)',
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontFamily: sg, fontWeight: 700, fontSize: 16, color: 'var(--t-text-1)' }}>
              {lead.nombreNegocio}
            </span>
            {lead.tipoNegocio && (
              <span style={{
                fontFamily: sg, fontSize: 11, fontWeight: 600, color: '#FF6A1A',
                background: '#FFF3EB', borderRadius: 20, padding: '2px 9px',
              }}>
                {lead.tipoNegocio}
              </span>
            )}
          </div>
          <div style={{ fontFamily: sg, fontSize: 13, color: 'var(--t-text-2)' }}>
            {lead.nombre}
          </div>
        </div>

        {/* status badge — click to cycle */}
        <button onClick={() => onStatusChange(lead.id, STATUS_CYCLE[lead.status])} style={{
          flexShrink: 0, fontFamily: sg, fontSize: 11, fontWeight: 700,
          color: meta.color, background: meta.bg,
          border: 'none', borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
          letterSpacing: '0.04em',
        }} title="Click para cambiar estado">
          {meta.label}
        </button>
      </div>

      {/* contact info */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
        <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: sm, fontSize: 13, color: 'var(--t-text-1)', textDecoration: 'none' }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {lead.whatsapp}
        </a>
        {lead.email && (
          <a href={`mailto:${lead.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: sg, fontSize: 13, color: 'var(--t-text-2)', textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--t-text-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>
            </svg>
            {lead.email}
          </a>
        )}
        {lead.instagram && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: sg, fontSize: 13, color: 'var(--t-text-2)' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--t-text-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="var(--t-text-4)"/>
            </svg>
            @{lead.instagram}
          </span>
        )}
      </div>

      {/* location + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: sg, fontSize: 12, color: 'var(--t-text-3)' }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          {[lead.ciudad, lead.departamento].filter(Boolean).join(', ') || '—'}
        </div>
        <span style={{ fontFamily: sm, fontSize: 11, color: 'var(--t-text-4)' }}>
          {fmtDate(lead.createdAt)}
        </span>
      </div>

      {/* mensaje */}
      {lead.mensaje && (
        <div>
          <button onClick={() => setExpanded((e) => !e)} style={{
            fontFamily: sg, fontSize: 12, fontWeight: 600, color: '#FF6A1A',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          }}>
            {expanded ? 'Ocultar mensaje ↑' : 'Ver mensaje ↓'}
          </button>
          {expanded && (
            <p style={{
              fontFamily: sg, fontSize: 13, color: 'var(--t-text-2)', lineHeight: 1.6,
              margin: '8px 0 0', background: 'var(--t-surface-2)', borderRadius: 8, padding: '10px 14px',
              borderLeft: '3px solid #FF6A1A',
            }}>
              {lead.mensaje}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── manager ─────────────────────────────────────────────────────────────────

export function LeadsManager() {
  const { data: leads = [], isLoading, error } = useLeads();
  const updateStatus = useUpdateLeadStatus();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<RestaurantLead['status'] | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const pendingCount = leads.filter((l) => l.status === 'pending').length;

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || [l.nombre, l.nombreNegocio, l.whatsapp, l.email].join(' ').toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  async function handleStatusChange(id: string, status: RestaurantLead['status']) {
    setUpdatingId(id);
    try { await updateStatus.mutateAsync({ id, status }); } finally { setUpdatingId(null); }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, fontFamily: sg, color: 'var(--t-text-3)' }}>
        <span style={{ width: 28, height: 28, border: '3px solid #FF6A1A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block', marginRight: 12 }} />
        Cargando inscripciones...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: sg, color: '#EA3B2E', padding: 24 }}>
        Error al cargar las inscripciones.
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: sg }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg) } }` }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontFamily: sg, fontSize: 22, fontWeight: 700, color: 'var(--t-text-1)', letterSpacing: '-0.03em', margin: 0 }}>
              Inscripciones
            </h1>
            {pendingCount > 0 && (
              <span style={{
                fontFamily: sg, fontSize: 12, fontWeight: 700,
                color: 'var(--t-badge-warn-text)', background: 'var(--t-badge-warn-bg)',
                borderRadius: 20, padding: '2px 10px',
              }}>
                {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p style={{ fontFamily: sg, fontSize: 13, color: 'var(--t-text-3)', margin: 0 }}>
            Restaurantes que se registraron desde la página principal
          </p>
        </div>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--t-text-4)" strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, negocio o WhatsApp..."
            style={{
              width: '100%', boxSizing: 'border-box', fontFamily: sg, fontSize: 13, color: 'var(--t-text-1)',
              background: 'var(--t-input-bg)', border: '1.5px solid var(--t-input-border)', borderRadius: 10,
              padding: '10px 14px 10px 36px', outline: 'none',
            }} />
        </div>

        {(['all', 'pending', 'contacted', 'active'] as const).map((s) => {
          const active = filterStatus === s;
          const labels = { all: 'Todos', pending: 'Pendientes', contacted: 'Contactados', active: 'Activos' };
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              fontFamily: sg, fontSize: 12.5, fontWeight: 600,
              color: active ? '#fff' : 'var(--t-text-2)',
              background: active ? '#FF6A1A' : 'var(--t-surface)',
              border: `1.5px solid ${active ? '#FF6A1A' : 'var(--t-border)'}`,
              borderRadius: 10, padding: '9px 14px', cursor: 'pointer',
            }}>
              {labels[s]}
            </button>
          );
        })}
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px', color: 'var(--t-text-4)',
          fontFamily: sg, fontSize: 14, background: 'var(--t-surface)', borderRadius: 14, border: '1px solid var(--t-border-2)',
        }}>
          {leads.length === 0 ? 'Aún no hay inscripciones registradas.' : 'No hay resultados para la búsqueda.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((lead) => (
            <div key={lead.id} style={{ opacity: updatingId === lead.id ? 0.6 : 1, transition: 'opacity .2s' }}>
              <LeadCard lead={lead} onStatusChange={handleStatusChange} />
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p style={{ fontFamily: sm, fontSize: 11, color: 'var(--t-text-4)', textAlign: 'right', marginTop: 16 }}>
          {filtered.length} de {leads.length} inscripción{leads.length !== 1 ? 'es' : ''}
        </p>
      )}
    </div>
  );
}
