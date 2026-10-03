'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

const sg = 'var(--font-sans, sans-serif)';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

interface DropPos {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

function TimeDrop({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<DropPos>({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => { setMounted(true); }, []);

  function openDrop() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 220) {
      setDropPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
    } else {
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(true);
  }

  // click-outside
  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !portalRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [open]);

  // scroll-outside
  useEffect(() => {
    if (!open) return;
    function handle(e: Event) {
      if (portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener('scroll', handle, true);
    return () => window.removeEventListener('scroll', handle, true);
  }, [open]);

  // scroll to selected
  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      const el = listRef.current?.querySelector('[data-selected="true"]') as HTMLElement | null;
      el?.scrollIntoView({ block: 'center' });
    }, 20);
  }, [open]);

  // escape
  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  const dropdown = open && mounted ? createPortal(
    <div
      ref={portalRef}
      style={{
        position: 'fixed',
        top: dropPos.top,
        bottom: dropPos.bottom,
        left: dropPos.left,
        width: Math.max(dropPos.width, 72),
        background: 'var(--t-surface, #fff)',
        border: '1.5px solid var(--t-border, #e5e7eb)',
        borderRadius: 12,
        boxShadow: '0 12px 32px -8px rgba(0,0,0,.22)',
        zIndex: 9999,
        overflowY: 'auto',
        maxHeight: 220,
      }}
    >
      <div ref={listRef}>
        {options.map((opt) => {
          const isSelected = opt === value;
          return (
            <button
              key={opt}
              type="button"
              data-selected={isSelected}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                width: '100%',
                textAlign: 'center',
                padding: '9px 12px',
                fontSize: 14,
                fontFamily: sg,
                fontWeight: isSelected ? 700 : 400,
                color: isSelected ? '#FF6A1A' : 'var(--t-text-1)',
                background: isSelected ? 'rgba(255,106,26,.08)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'block',
                transition: 'background .1s',
              }}
              onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--t-surface-2, #f5f0eb)'; }}
              onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {opt}
              {isSelected && (
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#FF6A1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6, display: 'inline', verticalAlign: 'middle' }}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => open ? setOpen(false) : openDrop()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width: 64,
          padding: '7px 8px',
          fontSize: 13,
          fontFamily: sg,
          fontWeight: 600,
          color: 'var(--t-text-1)',
          background: open ? 'rgba(255,106,26,.06)' : 'var(--t-input-bg)',
          border: `1.5px solid ${open ? '#FF6A1A' : 'var(--t-input-border)'}`,
          borderRadius: 9,
          cursor: 'pointer',
          outline: 'none',
          boxShadow: open ? '0 0 0 3px rgba(255,106,26,.13)' : 'none',
          transition: 'border-color .15s, box-shadow .15s',
        }}
      >
        <span>{value}</span>
        <svg
          viewBox="0 0 24 24" width="12" height="12" fill="none"
          stroke="var(--t-text-3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}

interface TimeSelectProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TimeSelect({ value, onChange, disabled }: TimeSelectProps) {
  const [hh, rawMm] = value ? value.split(':') : ['09', '00'];
  const mm = MINUTES.includes(rawMm) ? rawMm : '00';

  if (disabled) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 2, padding: '7px 10px', fontSize: 13, fontFamily: sg, fontWeight: 600,
        color: 'var(--t-text-3)', background: 'var(--t-surface-2)',
        border: '1.5px solid var(--t-input-border)', borderRadius: 9,
      }}>
        {hh}:{mm}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <TimeDrop options={HOURS} value={hh} onChange={(h) => onChange(`${h}:${mm}`)} />
      <span style={{ fontFamily: sg, fontWeight: 700, fontSize: 14, color: 'var(--t-text-3)', userSelect: 'none' }}>:</span>
      <TimeDrop options={MINUTES} value={mm} onChange={(m) => onChange(`${hh}:${m}`)} />
    </div>
  );
}
