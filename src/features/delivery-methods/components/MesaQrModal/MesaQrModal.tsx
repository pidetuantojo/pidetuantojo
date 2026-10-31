'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Mesa } from '@/types';

import { buildMesaUrl, mesaQrFileName } from '../../helpers/mesaQr.helpers';

interface MesaQrModalProps {
  // Una mesa o todas las activas ("Imprimir todos")
  mesas: Mesa[];
  restaurantSlug: string;
  restaurantName: string;
  onClose: () => void;
}

interface QrItem {
  mesa: Mesa;
  url: string;
  dataUrl: string;
}

const sg = 'var(--font-sans, sans-serif)';

/** QR de cada mesa: se descarga en PNG o se imprime (una tarjeta por hoja). */
export function MesaQrModal({ mesas, restaurantSlug, restaurantName, onClose }: MesaQrModalProps) {
  const [items, setItems] = useState<QrItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Import dinámico: `qrcode` solo se descarga cuando alguien abre este modal
        const QRCode = (await import('qrcode')).default;
        const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        const result = await Promise.all(mesas.map(async (mesa) => {
          const url = buildMesaUrl(base, restaurantSlug, mesa.id);
          const dataUrl = await QRCode.toDataURL(url, {
            width: 1024,               // alta resolución: se imprime nítido
            margin: 2,                 // zona de silencio: con 0 algunos lectores fallan
            errorCorrectionLevel: 'M',
          });
          return { mesa, url, dataUrl };
        }));
        if (!cancelled) setItems(result);
      } catch {
        if (!cancelled) setError('No se pudo generar el QR. Intenta de nuevo.');
      }
    })();
    return () => { cancelled = true; };
  }, [mesas, restaurantSlug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function download(item: QrItem) {
    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = mesaQrFileName(restaurantSlug, item.mesa.name);
    a.click();
  }

  const single = mesas.length === 1;

  return (
    <>
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, fontFamily: sg }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={single ? `QR de ${mesas[0]?.name}` : 'QR de las mesas'}
          style={{ background: 'var(--t-surface)', borderRadius: 20, padding: '24px 28px', width: single ? 400 : 760, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--t-text-1)' }}>
              {single ? `QR de ${mesas[0]?.name}` : `QR de las mesas (${mesas.length})`}
            </h3>
            <button type="button" onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--t-text-3)', fontSize: 18 }}>
              ✕
            </button>
          </div>

          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-3)', lineHeight: 1.5 }}>
            Imprímelo y pégalo en la mesa. Al escanearlo, el cliente abre tu menú con la mesa ya elegida. Si cambias el nombre de la mesa, el QR sigue sirviendo; si la eliminas, deja de funcionar.
          </p>

          {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>{error}</p>}
          {!error && items.length === 0 && (
            <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--t-text-3)' }}>Generando QR…</p>
          )}

          <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: single ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {items.map((item) => (
              <div key={item.mesa.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1px solid var(--t-border)', borderRadius: 14, padding: 14, textAlign: 'center', background: '#fff' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1B1512' }}>{item.mesa.name}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.dataUrl} alt={`QR de ${item.mesa.name}`} style={{ width: single ? 220 : 160, height: single ? 220 : 160 }} />
                <button
                  type="button"
                  onClick={() => download(item)}
                  style={{ padding: '6px 14px', borderRadius: 999, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Descargar PNG
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'transparent', color: 'var(--t-text-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cerrar
            </button>
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => window.print()}
              style={{ padding: '9px 18px', borderRadius: 999, border: 'none', background: '#FF6A1A', color: '#fff', fontSize: 14, fontWeight: 700, cursor: items.length ? 'pointer' : 'not-allowed', opacity: items.length ? 1 : 0.6 }}
            >
              {single ? 'Imprimir' : 'Imprimir todos'}
            </button>
          </div>
        </div>
      </div>

      {/* Hoja de impresión: portal directo en <body>, oculto en pantalla (ver #qr-print-root en globals.css) */}
      {items.length > 0 && createPortal(
        <div id="qr-print-root">
          {items.map((item) => (
            <div key={item.mesa.id} className="qr-print-card">
              <p style={{ margin: 0, fontSize: 18, color: '#6b6058' }}>{restaurantName}</p>
              <p style={{ margin: '4px 0 0', fontSize: 40, fontWeight: 800, color: '#1B1512' }}>{item.mesa.name}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.dataUrl} alt="" style={{ width: '11cm', height: '11cm', margin: '0.8cm 0' }} />
              <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#1B1512' }}>Escanea para ver el menú y pedir</p>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
