'use client';

import { Trash2 } from 'lucide-react';

import { useConfirmStore } from '@/store/confirm.store';

export function ConfirmDialog() {
  const { isOpen, title, message, confirmLabel, respond } = useConfirmStore();

  if (!isOpen) return null;

  return (
    <div
      onClick={() => respond(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: 400,
          padding: '28px 28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Ícono */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#FEF2F2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trash2 style={{ width: 24, height: 24, color: '#DC2626' }} />
          </div>
        </div>

        {/* Texto */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 17, color: '#111827', margin: '0 0 8px' }}>
            {title}
          </p>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
            {message}
          </p>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={() => respond(false)}
            style={{
              flex: 1, height: 42, borderRadius: 12, border: '1.5px solid #E5E7EB',
              background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14,
              cursor: 'pointer', transition: 'background .15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
          >
            Cancelar
          </button>
          <button
            onClick={() => respond(true)}
            style={{
              flex: 1, height: 42, borderRadius: 12, border: 'none',
              background: '#DC2626', color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: 'pointer', transition: 'background .15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#B91C1C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#DC2626'; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
