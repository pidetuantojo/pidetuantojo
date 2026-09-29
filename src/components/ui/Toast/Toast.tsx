'use client';

import { useToastStore } from '@/store/toast.store';
import type { Toast } from '@/store/toast.store';

const VARIANTS = {
  success: {
    border: '#22c55e',
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
    icon: '✓',
  },
  error: {
    border: '#ef4444',
    iconBg: '#fef2f2',
    iconColor: '#dc2626',
    icon: '✕',
  },
} as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const v = VARIANTS[toast.type];
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderLeft: `4px solid ${v.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        minWidth: 280,
        maxWidth: 360,
        fontFamily: 'var(--font-sans, sans-serif)',
        animation: 'toast-in 0.2s ease',
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: v.iconBg, color: v.iconColor,
        display: 'grid', placeItems: 'center',
        flexShrink: 0, fontSize: 11, fontWeight: 700,
      }}>
        {v.icon}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.4, flex: 1 }}>
        {toast.msg}
      </span>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  if (!toasts.length) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}} />
      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
        pointerEvents: 'none',
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </>
  );
}
