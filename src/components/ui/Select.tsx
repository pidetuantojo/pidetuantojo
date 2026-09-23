'use client';

import { useState, useRef, useEffect, useId } from 'react';

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
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Seleccioná...',
  label,
  error,
  hint,
  disabled,
  style,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div style={{ ...style, fontFamily: sg }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontWeight: 500, fontSize: 13, color: '#5a5048', display: 'block', marginBottom: 6 }}
        >
          {label}
        </label>
      )}

      <div ref={ref} style={{ position: 'relative' }}>
        {/* Trigger */}
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 14,
            color: selected ? '#1B1512' : '#a89e95',
            border: `1.5px solid ${open ? '#FF6A1A' : error ? '#EA3B2E' : '#E7DED6'}`,
            background: disabled ? '#F7F4F1' : '#fff',
            borderRadius: 12,
            padding: '11px 14px',
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
            stroke="#9a8f86"
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

        {/* Dropdown */}
        {open && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: '#fff',
              border: '1.5px solid #E7DED6',
              borderRadius: 12,
              boxShadow: '0 8px 24px -8px rgba(27,21,18,.18)',
              zIndex: 50,
              overflow: 'hidden',
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            {options.map((opt) => {
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
                    color: isSelected ? '#FF6A1A' : '#1B1512',
                    background: isSelected ? 'rgba(255,106,26,.07)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#FBF8F5';
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
        )}
      </div>

      {hint && !error && (
        <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: '#9a8f86', marginTop: 5 }}>
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
