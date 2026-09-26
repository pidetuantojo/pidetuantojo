'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Printer, RefreshCw, XCircle } from 'lucide-react';

import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { describePrintError, getQzVersion, listPrinters, printRaw } from '@/lib/printer/qzClient';
import { buildTestTicket } from '@/lib/printer/ticketBuilder';
import type { PaperWidth, PrinterEncoding } from '@/types';

import { usePrinterConfig, useSavePrinterConfig } from '../../hooks/usePrinterConfig';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";
// Colores del tema del dashboard (claro/oscuro)
const C = { primary: '#FF6A1A', dark: 'var(--t-text-1)', muted: 'var(--t-text-3)', border: 'var(--t-border-2)', soft: 'var(--t-surface-2)', surface: 'var(--t-surface)' };

type QzState = 'checking' | 'connected' | 'unavailable';
type TestState = { printer: string; status: 'printing' | 'ok' | 'error'; message?: string };

const cardStyle: React.CSSProperties = { background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '18px 20px' };
const labelStyle: React.CSSProperties = { fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: C.muted, textTransform: 'uppercase' };

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: sg, fontSize: 13, fontWeight: 600,
        border: `2px solid ${selected ? C.primary : C.border}`, background: selected ? 'rgba(255,106,26,.12)' : C.surface,
        color: selected ? C.primary : C.dark,
      }}
    >
      {children}
    </button>
  );
}

/** Configuración de la impresora térmica (QZ Tray): estado, impresoras detectadas, prueba y guardado. */
export function PrinterSettings() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';
  const { data: restaurant } = useRestaurant(restaurantId || undefined);
  const { data: saved, isLoading } = usePrinterConfig(restaurantId || undefined);
  const save = useSavePrinterConfig(restaurantId);

  const [qzState, setQzState] = useState<QzState>('checking');
  const [qzVersion, setQzVersion] = useState<string | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [listError, setListError] = useState('');

  const [selected, setSelected] = useState('');
  const [paperWidth, setPaperWidth] = useState<PaperWidth>(80);
  const [encoding, setEncoding] = useState<PrinterEncoding>('cp850');
  const [test, setTest] = useState<TestState | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // Cargar lo guardado una vez
  useEffect(() => {
    if (!saved) return;
    setSelected(saved.name);
    setPaperWidth(saved.paperWidth);
    setEncoding(saved.encoding);
  }, [saved]);

  const detect = useCallback(async () => {
    setQzState('checking');
    setListError('');
    const version = await getQzVersion();
    if (!version) {
      setQzState('unavailable');
      setPrinters([]);
      return;
    }
    setQzVersion(version);
    setQzState('connected');
    try {
      setPrinters(await listPrinters());
    } catch (err) {
      setListError(describePrintError(err));
    }
  }, []);

  useEffect(() => { detect(); }, [detect]);

  async function handleTest(printerName: string) {
    setTest({ printer: printerName, status: 'printing' });
    try {
      const ticket = buildTestTicket({ name: printerName, paperWidth, encoding }, restaurant?.name ?? 'Prueba');
      await printRaw(printerName, ticket, encoding);
      setTest({ printer: printerName, status: 'ok' });
    } catch (err) {
      setTest({ printer: printerName, status: 'error', message: describePrintError(err) });
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSavedOk(false);
    await save.mutateAsync({ name: selected, paperWidth, encoding });
    setSavedOk(true);
  }

  if (!restaurantId) return null;

  const dirty = !saved || saved.name !== selected || saved.paperWidth !== paperWidth || saved.encoding !== encoding;
  const savedMissing = !!saved && qzState === 'connected' && printers.length > 0 && !printers.includes(saved.name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: sg, maxWidth: 760 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.dark, letterSpacing: '-.02em' }}>Impresoras</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: C.muted }}>
          Imprime las comandas directo en tu impresora térmica, sin ventanas de impresión. Necesita QZ Tray abierto en este computador.
        </p>
      </div>

      {/* Estado QZ Tray */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {qzState === 'checking' && <Loader2 size={22} color={C.muted} className="animate-spin" />}
        {qzState === 'connected' && <CheckCircle2 size={22} color="#059669" />}
        {qzState === 'unavailable' && <XCircle size={22} color="#ef4444" />}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>
            {qzState === 'checking' && 'Buscando QZ Tray...'}
            {qzState === 'connected' && `QZ Tray conectado${qzVersion ? ` (v${qzVersion})` : ''}`}
            {qzState === 'unavailable' && 'QZ Tray no está abierto en este equipo'}
          </div>
          {qzState === 'unavailable' && (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              Instálalo desde{' '}
              <a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer" style={{ color: C.primary, fontWeight: 600 }}>qz.io/download</a>
              , ábrelo y presiona Reintentar.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={detect}
          disabled={qzState === 'checking'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${C.border}`, background: C.surface, fontFamily: sg, fontWeight: 600, fontSize: 13, color: C.dark, cursor: 'pointer' }}
        >
          <RefreshCw size={14} /> {qzState === 'unavailable' ? 'Reintentar' : 'Actualizar'}
        </button>
      </div>

      {/* Impresoras detectadas */}
      <div style={cardStyle}>
        <div style={{ ...labelStyle, marginBottom: 12 }}>Impresoras detectadas ({printers.length})</div>
        {listError && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#ef4444' }}>{listError}</p>}
        {savedMissing && (
          <p style={{ margin: '0 0 10px', fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px' }}>
            La impresora guardada (&quot;{saved?.name}&quot;) no aparece en este equipo. Elige otra o revisa que esté conectada.
          </p>
        )}
        {qzState !== 'connected' ? (
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Conecta QZ Tray para ver las impresoras.</p>
        ) : printers.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No se encontraron impresoras instaladas en este equipo.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {printers.map((name) => {
              const isSel = selected === name;
              const t = test?.printer === name ? test : null;
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 12, border: `2px solid ${isSel ? C.primary : C.border}`, background: isSel ? 'rgba(255,106,26,.12)' : C.soft }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 180, cursor: 'pointer' }}>
                    <input type="radio" name="printer" checked={isSel} onChange={() => setSelected(name)} style={{ accentColor: C.primary, width: 16, height: 16 }} />
                    <Printer size={16} color={isSel ? C.primary : C.muted} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: C.dark, overflowWrap: 'anywhere' }}>{name}</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t?.status === 'ok' && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>Enviado ✓</span>}
                    {t?.status === 'error' && <span style={{ fontSize: 12, color: '#ef4444' }}>{t.message}</span>}
                    <button
                      type="button"
                      onClick={() => handleTest(name)}
                      disabled={t?.status === 'printing'}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${C.border}`, background: C.surface, fontFamily: sg, fontWeight: 600, fontSize: 12, color: C.dark, cursor: 'pointer' }}
                    >
                      {t?.status === 'printing' ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                      Probar impresión
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formato */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Ancho del papel</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip selected={paperWidth === 80} onClick={() => setPaperWidth(80)}>80 mm (48 caracteres)</Chip>
            <Chip selected={paperWidth === 58} onClick={() => setPaperWidth(58)}>58 mm (32 caracteres)</Chip>
          </div>
        </div>
        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Tildes y ñ</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip selected={encoding === 'cp850'} onClick={() => setEncoding('cp850')}>Con tildes (recomendado)</Chip>
            <Chip selected={encoding === 'ascii'} onClick={() => setEncoding('ascii')}>Sin tildes</Chip>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: C.muted }}>
            Si en la prueba ves símbolos raros en lugar de á, é, ñ, elige &quot;Sin tildes&quot;.
          </p>
        </div>
      </div>

      {/* Guardar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!selected || !dirty || save.isPending || isLoading}
          style={{ padding: '12px 24px', borderRadius: 999, border: 'none', background: C.primary, color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: !selected || !dirty || save.isPending ? 0.5 : 1 }}
        >
          {save.isPending ? 'Guardando...' : 'Guardar impresora'}
        </button>
        {savedOk && !dirty && <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>Guardado ✓</span>}
        {saved && (
          <span style={{ fontSize: 13, color: C.muted }}>
            Actual: <strong style={{ color: C.dark }}>{saved.name}</strong> · {saved.paperWidth} mm
          </span>
        )}
        {save.isError && <span style={{ fontSize: 13, color: '#ef4444' }}>No se pudo guardar. Intenta de nuevo.</span>}
      </div>
    </div>
  );
}
