'use client';

import { useState } from 'react';
import { Trash2, X } from 'lucide-react';

import type { Order } from '@/types';

interface Props {
  order: Order | null;
  isDeleting: boolean;
  onConfirm: (orderId: string, reason: string) => Promise<void>;
  onClose: () => void;
}

export function DeleteOrderModal({ order, isDeleting, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('');

  if (!order) return null;

  async function handleConfirm() {
    if (!order) return;
    await onConfirm(order.id, reason);
    setReason('');
  }

  function handleClose() {
    if (isDeleting) return;
    setReason('');
    onClose();
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
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
          maxWidth: 440,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Trash2 style={{ width: 18, height: 18, color: '#DC2626' }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#111827', margin: 0 }}>
                Eliminar pedido
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                {order.orderNumber} · {order.customerName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: '#F3F4F6', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <X style={{ width: 16, height: 16, color: '#6B7280' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px 0' }}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, margin: '0 0 16px' }}>
            El pedido <strong>no se eliminará</strong> de la base de datos — quedará marcado como eliminado y solo será visible en el historial de auditoría.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>
              Motivo de eliminación <span style={{ fontWeight: 400 }}>(opcional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Pedido duplicado, cliente canceló, error de captura..."
              rows={3}
              disabled={isDeleting}
              style={{
                width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 10,
                padding: '9px 12px', fontSize: 14, color: '#111827',
                outline: 'none', resize: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit', lineHeight: 1.5,
                background: isDeleting ? '#F9FAFB' : '#fff',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#FF6A1A'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 24px 20px' }}>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            style={{
              flex: 1, height: 42, borderRadius: 12, border: '1.5px solid #E5E7EB',
              background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14,
              cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            style={{
              flex: 1, height: 42, borderRadius: 12, border: 'none',
              background: isDeleting ? '#F87171' : '#DC2626',
              color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background .15s',
            }}
          >
            {isDeleting ? (
              <>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', display: 'block',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 style={{ width: 15, height: 15 }} />
                Eliminar pedido
              </>
            )}
          </button>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      </div>
    </div>
  );
}
