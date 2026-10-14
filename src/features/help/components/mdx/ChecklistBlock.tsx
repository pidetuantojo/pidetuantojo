'use client';

import { useEffect, useState } from 'react';

const sg = "var(--font-sans, sans-serif)";
const ORANGE = '#FF6A1A';

interface ChecklistBlockProps {
  id: string;
  items: string[];
}

/**
 * Checklist interactivo con persistencia en localStorage.
 * Uso en MDX: <Checklist id="onboarding" items={["Item 1", "Item 2"]} />
 */
export function ChecklistBlock({ id, items }: ChecklistBlockProps) {
  const key = `help-checklist-${id}`;
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored: number[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      setChecked(new Set(stored));
    } catch {}
    setReady(true);
  }, [key]);

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      try { localStorage.setItem(key, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }

  function reset() {
    setChecked(new Set());
    try { localStorage.removeItem(key); } catch {}
  }

  const done = checked.size;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = done === total;

  return (
    <div style={{ background: 'var(--t-surface)', border: `1.5px solid ${allDone ? '#059669' : 'var(--t-border)'}`, borderRadius: 16, padding: '16px 18px', margin: '16px 0', fontFamily: sg, transition: 'border-color .3s' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: 'var(--t-text-1)' }}>
            {allDone ? '¡Listo para recibir pedidos!' : 'Tu restaurante, paso a paso'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--t-text-3)' }}>
            {done} de {total} completados
          </p>
        </div>
        {done > 0 && !allDone && (
          <button
            type="button"
            onClick={reset}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--t-text-3)', padding: '4px 8px', borderRadius: 8 }}
          >
            Reiniciar
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: 'var(--t-surface-2)', borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: '100%', width: ready ? `${pct}%` : '0%', background: allDone ? '#059669' : ORANGE, borderRadius: 999, transition: 'width .4s ease, background .3s' }} />
      </div>

      {/* Items */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => {
          const isChecked = checked.has(i);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: isChecked ? (allDone ? '#ECFDF5' : `${ORANGE}0D`) : 'var(--t-surface-2)',
                  transition: 'background .2s',
                  fontFamily: sg,
                }}
              >
                <span style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                  border: `2px solid ${isChecked ? (allDone ? '#059669' : ORANGE) : 'var(--t-border)'}`,
                  background: isChecked ? (allDone ? '#059669' : ORANGE) : 'transparent',
                  display: 'grid', placeItems: 'center',
                  transition: 'all .2s',
                }}>
                  {isChecked && (
                    <svg viewBox="0 0 10 8" width="10" height="8" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span style={{ fontSize: 14, fontWeight: isChecked ? 500 : 600, color: isChecked ? 'var(--t-text-3)' : 'var(--t-text-1)', textDecoration: isChecked ? 'line-through' : 'none', transition: 'color .2s' }}>
                  {item}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
