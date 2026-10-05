'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

const sg = "var(--font-sans, sans-serif)";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  max?: number;
  compact?: boolean;
}

interface DropPos {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

const ORANGE = '#FF6A1A';

export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = 'Selecciona...',
  label,
  error,
  hint,
  disabled,
  max,
  compact,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<DropPos>({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => { setMounted(true); }, []);

  function openSelect() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 300) {
      setDropPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left, width: rect.width });
    } else {
      setDropPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !portalRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: Event) {
      if (portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener('scroll', handle, true);
    return () => window.removeEventListener('scroll', handle, true);
  }, [open]);

  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      if (max && values.length >= max) return;
      onChange([...values, value]);
    }
  }

  const selectedOptions = options.filter((o) => values.includes(o.value));
  const maxReached = max !== undefined && values.length >= max;

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
        maxHeight: 300,
        overflow: 'hidden',
      }}
    >
      {/* Header con contador */}
      {max && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--t-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: 'var(--t-text-3)', fontFamily: sg }}>
            Seleccioná hasta {max}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: maxReached ? ORANGE : 'var(--t-text-3)',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {values.length}/{max}
          </span>
        </div>
      )}

      {/* Opciones */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {options.map((opt) => {
          const isSelected = values.includes(opt.value);
          const isDisabled = !isSelected && maxReached;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={isDisabled}
              onClick={() => toggle(opt.value)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                fontSize: 14,
                fontFamily: sg,
                color: isDisabled ? 'var(--t-text-4)' : isSelected ? ORANGE : 'var(--t-text-1)',
                background: isSelected ? `rgba(255,106,26,.07)` : 'transparent',
                border: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'background .12s',
                opacity: isDisabled ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isSelected && !isDisabled) (e.currentTarget as HTMLElement).style.background = 'var(--t-surface-2, #f5f0eb)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {/* Checkbox custom */}
              <span style={{
                width: 18, height: 18, borderRadius: 6, flexShrink: 0,
                border: `2px solid ${isSelected ? ORANGE : 'var(--t-border)'}`,
                background: isSelected ? ORANGE : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .12s, border-color .12s',
              }}>
                {isSelected && (
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span style={{ flex: 1 }}>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ fontFamily: sg }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontWeight: 500, fontSize: 14, color: 'var(--t-text-2)', display: 'block', marginBottom: 4 }}
        >
          {label}
        </label>
      )}

      <div ref={ref} style={{ position: 'relative' }}>
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
            gap: 6,
            fontSize: 14,
            border: `1.5px solid ${open ? ORANGE : error ? '#EA3B2E' : 'var(--t-input-border)'}`,
            background: disabled ? 'var(--t-surface-2)' : 'var(--t-input-bg)',
            borderRadius: 12,
            padding: compact ? '6px 10px' : '8px 10px',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: open ? `0 0 0 4px rgba(255,106,26,.13)` : 'none',
            transition: 'border-color .15s, box-shadow .15s',
            textAlign: 'left',
            minHeight: compact ? 36 : 42,
            flexWrap: 'wrap',
          }}
        >
          {/* Chips de seleccionados o placeholder */}
          <span style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {selectedOptions.length === 0 ? (
              <span style={{ color: 'var(--t-text-4)', fontSize: 14 }}>{placeholder}</span>
            ) : selectedOptions.map((opt) => (
              <span
                key={opt.value}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: `rgba(255,106,26,.12)`,
                  color: ORANGE,
                  borderRadius: 999,
                  fontSize: 12, fontWeight: 600,
                  padding: '3px 8px',
                }}
              >
                {opt.label}
                <span
                  role="button"
                  aria-label={`Quitar ${opt.label}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    toggle(opt.value);
                  }}
                  style={{ lineHeight: 1, cursor: 'pointer', opacity: .7, fontSize: 13 }}
                >
                  ×
                </span>
              </span>
            ))}
          </span>

          <svg
            viewBox="0 0 24 24" width="16" height="16" fill="none"
            stroke="var(--t-text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {dropdown}
      </div>

      {hint && !error && (
        <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--t-text-3)', marginTop: 5 }}>
          {hint}
        </p>
      )}
      {error && (
        <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#EA3B2E', marginTop: 5 }}>
          {error}
        </p>
      )}
    </div>
  );
}
