'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

const sg = "var(--font-sans, sans-serif)";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  searchable?: boolean;
  compact?: boolean;
}

interface DropPos {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Selecciona...',
  label,
  error,
  hint,
  disabled,
  style,
  searchable,
  compact,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropPos, setDropPos] = useState<DropPos>({ top: 0, left: 0, width: 0 });
  const searchRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value);

  // Necesario para que createPortal funcione en SSR (Next.js)
  useEffect(() => { setMounted(true); }, []);

  function openSelect() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 260) {
      // Abrir hacia arriba
      setDropPos({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
    setOpen(true);
    if (searchable) {
      setQuery('');
      // pequeño delay para que el portal se monte antes del focus
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }

  // Click/touch outside → cerrar
  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const target = e.target as Node;
      const insideTrigger = ref.current?.contains(target);
      const insidePortal = portalRef.current?.contains(target);
      if (!insideTrigger && !insidePortal) setOpen(false);
    }
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [open]);

  // Scroll → cerrar solo si el scroll fue fuera del dropdown (página/contenedor, no la lista interna)
  useEffect(() => {
    if (!open) return;
    function handle(e: Event) {
      if (portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener('scroll', handle, true);
    return () => window.removeEventListener('scroll', handle, true);
  }, [open]);

  // Escape → cerrar
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  const filteredOptions = searchable && query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const dropdown = open && mounted ? createPortal(
    <div
      ref={portalRef}
      style={{
        position: 'fixed',
        top: dropPos.top,
        bottom: dropPos.bottom,
        left: dropPos.left,
        width: dropPos.width,
        background: 'var(--t-surface, #fff)',
        border: '1.5px solid var(--t-border, #e5e7eb)',
        borderRadius: 12,
        boxShadow: '0 12px 32px -8px rgba(0,0,0,.22)',
        zIndex: 9999,
        fontFamily: sg,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 280,
      }}
    >
      {searchable && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--t-border, #e5e7eb)', flexShrink: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--t-text-3, #9ca3af)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 9, flexShrink: 0, pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              style={{
                width: '100%',
                paddingLeft: 30,
                paddingRight: 10,
                paddingTop: 7,
                paddingBottom: 7,
                fontSize: 13,
                fontFamily: sg,
                color: 'var(--t-text-1)',
                background: 'var(--t-surface-2, #f5f0eb)',
                border: '1px solid var(--t-border, #e5e7eb)',
                borderRadius: 8,
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}
      <div style={{ overflowY: 'auto', flex: 1 }}>
      {filteredOptions.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--t-text-3)', textAlign: 'center' }}>
          Sin resultados
        </div>
      ) : filteredOptions.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); setOpen(false); }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 14px',
              fontSize: 14,
              fontFamily: sg,
              color: isSelected ? '#FF6A1A' : 'var(--t-text-1)',
              background: isSelected ? 'rgba(255,106,26,.07)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'background .12s',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--t-surface-2, #f5f0eb)';
            }}
            onMouseLeave={(e) => {
              if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {opt.label}
            {isSelected && (
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#FF6A1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </button>
        );
      })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ ...style, fontFamily: sg }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontWeight: 500, fontSize: 14, color: 'var(--t-text-2)', display: 'block', marginBottom: 4 }}
        >
          {label}
        </label>
      )}

      <div ref={ref} style={{ position: 'relative' }}>
        {/* Trigger */}
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => open ? setOpen(false) : openSelect()}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 14,
            color: selected ? 'var(--t-text-1)' : 'var(--t-text-4)',
            border: `1.5px solid ${open ? '#FF6A1A' : error ? '#EA3B2E' : 'var(--t-input-border)'}`,
            background: disabled ? 'var(--t-surface-2)' : 'var(--t-input-bg)',
            borderRadius: 12,
            padding: compact ? '8px 14px' : '11px 14px',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: open ? '0 0 0 4px rgba(255,106,26,.13)' : 'none',
            transition: 'border-color .15s, box-shadow .15s',
            textAlign: 'left',
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.label : placeholder}
          </span>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="var(--t-text-3)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              flexShrink: 0,
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform .2s',
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {dropdown}
      </div>

      {hint && !error && (
        <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: 'var(--t-text-3)', marginTop: 5 }}>
          {hint}
        </p>
      )}
      {error && (
        <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: '#EA3B2E', marginTop: 5 }}>
          {error}
        </p>
      )}
    </div>
  );
}
