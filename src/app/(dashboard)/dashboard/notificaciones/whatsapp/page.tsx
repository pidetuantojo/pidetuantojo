'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';

type WaStatus = 'disconnected' | 'connecting' | 'connected';

interface WaState {
  status: WaStatus;
  qr: string | null;
  connectedNumber: string | null;
  lastError: string | null;
}

const STATUS_LABEL: Record<WaStatus, string> = {
  disconnected: 'Desconectado',
  connecting: 'Conectando...',
  connected: 'Conectado',
};

const STATUS_COLOR: Record<WaStatus, string> = {
  disconnected: '#ef4444',
  connecting: '#f59e0b',
  connected: '#22c55e',
};

export default function WhatsAppPage() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  const [state, setState] = useState<WaState>({ status: 'disconnected', qr: null, connectedNumber: null, lastError: null });
  const [loading, setLoading] = useState(false);
  const [qrWasShown, setQrWasShown] = useState(false);
  const qrWasShownRef = useRef(false);

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/whatsapp/connect?restaurantId=${restaurantId}`);
      const data = await res.json();
      setState((prev) => {
        // QR desapareció → fue escaneado
        if (prev.qr && !data.qr) {
          qrWasShownRef.current = true;
          setQrWasShown(true);
        }
        // Conectado o error definitivo → limpiar flag
        if (data.status === 'connected' || data.lastError) {
          qrWasShownRef.current = false;
          setQrWasShown(false);
        }
        // Si el QR fue escaneado y viene un "disconnected" transitorio → ignorarlo, mostrar "verificando"
        if (qrWasShownRef.current && data.status === 'disconnected' && !data.lastError) {
          return { ...data, status: 'connecting' as const };
        }
        return data;
      });
    } catch {
      // silencioso
    }
  }

  async function handleConnect() {
    setLoading(true);
    await fetch(`/api/whatsapp/connect?restaurantId=${restaurantId}`, { method: 'POST' });
    setLoading(false);
    fetchStatus();
  }

  async function handleDisconnect() {
    setLoading(true);
    await fetch(`/api/whatsapp/connect?restaurantId=${restaurantId}`, { method: 'DELETE' });
    setLoading(false);
    fetchStatus();
  }

  // Poll: 1s mientras conectando, 5s una vez conectado para detectar desconexiones
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, state.status === 'connecting' ? 1000 : 5000);
    return () => clearInterval(interval);
  }, [state.status]);

  return (
    <div style={{ padding: '32px 24px', maxWidth: 520, margin: '0 auto', fontFamily: 'var(--font-sans, sans-serif)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, background: '#dcfce7',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#16a34a">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t-text-1)', margin: 0 }}>
            WhatsApp Business
          </h1>
          <p style={{ fontSize: 13, color: 'var(--t-text-3)', margin: '2px 0 0' }}>
            Notificaciones automáticas al cliente
          </p>
        </div>
      </div>

      {/* Status card */}
      <div style={{
        background: 'var(--t-surface)', border: '1px solid var(--t-border)',
        borderRadius: 16, padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: 'var(--t-text-2)', fontWeight: 500 }}>Estado</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            background: `${STATUS_COLOR[state.status]}18`,
            color: STATUS_COLOR[state.status],
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: STATUS_COLOR[state.status],
              ...(state.status === 'connecting' ? { animation: 'pulse 1.2s infinite' } : {}),
            }} />
            {STATUS_LABEL[state.status]}
          </span>
        </div>

        {state.connectedNumber && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--t-text-3)' }}>
            Número: <strong style={{ color: 'var(--t-text-1)' }}>+{state.connectedNumber}</strong>
          </div>
        )}
      </div>

      {/* QR code */}
      {state.status === 'connecting' && state.qr && (
        <div style={{
          background: 'var(--t-surface)', border: '1px solid var(--t-border)',
          borderRadius: 16, padding: 24, marginBottom: 24,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <p style={{ fontSize: 14, color: 'var(--t-text-2)', textAlign: 'center', margin: 0 }}>
            Abrí WhatsApp en tu teléfono →<br />
            <strong>Dispositivos vinculados → Vincular dispositivo</strong><br />
            y escaneá este código
          </p>
          <img
            src={state.qr}
            alt="QR WhatsApp"
            width={220}
            height={220}
            style={{ borderRadius: 12, border: '1px solid var(--t-border)' }}
          />
          <p style={{ fontSize: 12, color: 'var(--t-text-3)', margin: 0 }}>
            El código se actualiza automáticamente
          </p>
        </div>
      )}

      {/* Waiting for QR / Verifying after scan */}
      {state.status === 'connecting' && !state.qr && (
        <div style={{
          background: 'var(--t-surface)', border: `1px solid ${qrWasShown ? '#bbf7d0' : 'var(--t-border)'}`,
          borderRadius: 16, padding: 32, marginBottom: 24,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          transition: 'border-color .3s',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: `3px solid ${qrWasShown ? '#bbf7d0' : 'var(--t-border)'}`,
            borderTopColor: qrWasShown ? '#22c55e' : '#22c55e',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: 14, color: qrWasShown ? '#15803d' : 'var(--t-text-2)', margin: 0, fontWeight: qrWasShown ? 600 : 400 }}>
            {qrWasShown ? '✓ QR escaneado — verificando conexión...' : 'Generando código QR...'}
          </p>
        </div>
      )}

      {/* Connected success */}
      {state.status === 'connected' && (
        <>
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 16, padding: '16px 20px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 24 }}>✅</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#15803d', margin: 0 }}>
                WhatsApp conectado
              </p>
              <p style={{ fontSize: 13, color: '#16a34a', margin: '2px 0 0' }}>
                Los mensajes automáticos están activos. Cuando el pedido pase a <strong>Confirmado</strong>, el cliente recibe una notificación.
              </p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            style={{
              width: '100%', padding: '12px 24px', borderRadius: 999,
              background: 'transparent', border: '1.5px solid #ef4444', color: '#ef4444',
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, fontFamily: 'var(--font-sans, sans-serif)',
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            Desconectar WhatsApp
          </button>
        </>
      )}

      {/* Error */}
      {state.lastError && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: '#dc2626',
        }}>
          <strong>Error:</strong> {state.lastError}
        </div>
      )}

      {/* Connect button */}
      {state.status === 'disconnected' && (
        <button
          onClick={handleConnect}
          disabled={loading}
          style={{
            width: '100%', padding: '14px 24px', borderRadius: 999,
            background: '#16a34a', border: 'none', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 10, transition: 'opacity .15s',
            fontFamily: 'var(--font-sans, sans-serif)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          {loading ? 'Iniciando...' : 'Conectar WhatsApp'}
        </button>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
