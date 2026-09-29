'use client';

import { useRef } from 'react';

const ORANGE = '#FF6A1A';

interface CheckboxProps {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function Checkbox({ checked, onChange, indeterminate, disabled, style }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  if (ref.current) ref.current.indeterminate = !!indeterminate;
  const active = checked || !!indeterminate;
  return (
    <span style={{ position: 'relative', width: 16, height: 16, flexShrink: 0, display: 'inline-flex', ...style }}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, cursor: disabled ? 'default' : 'pointer' }}
      />
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 4,
        border: `1.5px solid ${active ? ORANGE : 'var(--t-border-2, #e5e7eb)'}`,
        background: active ? ORANGE : 'var(--t-input-bg, #fff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.5 : 1, pointerEvents: 'none',
        transition: 'background .12s, border-color .12s',
      }}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 3.5L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {!checked && indeterminate && (
          <svg width="8" height="2" viewBox="0 0 8 2" fill="none">
            <path d="M1 1H7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </span>
  );
}
