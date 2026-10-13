'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Modal pequeño que se abre encima del panel del pedido (pagar, descuento, trasladar...). */
export function DrawerDialog({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[var(--t-surface)] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--t-border)] px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-[var(--t-text-1)]">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--t-text-3)]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[var(--t-border)] text-[var(--t-text-3)] hover:bg-[var(--t-surface-2)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex gap-2 border-t border-[var(--t-border)] px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function DialogButton({
  children,
  onClick,
  disabled,
  tone = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'ghost' | 'danger' | 'success';
  className?: string;
}) {
  const tones = {
    primary: 'bg-[#FF6A1A] text-white hover:bg-[#ea5f12]',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text-2)] hover:bg-[var(--t-surface-2)]',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder = '0',
  autoFocus,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-[var(--t-input-border)] bg-[var(--t-input-bg)] px-3 py-2 focus-within:border-[#FF6A1A]">
      <span className="text-sm text-[var(--t-text-4)]">$</span>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm font-bold tabular-nums text-[var(--t-text-1)] outline-none placeholder-[var(--t-text-4)]"
      />
    </div>
  );
}

export function toInt(value: string): number {
  const n = parseInt(value.replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Botón cuadrado de la grilla de acciones (Imprimir, Agregar, Descuento, WhatsApp). */
export function ActionTile({
  icon,
  label,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'teal' | 'green';
}) {
  const tones = {
    neutral: 'border-[var(--t-border)] text-[var(--t-text-2)] hover:bg-[var(--t-surface-2)]',
    teal: 'border-teal-300 text-teal-700 hover:bg-teal-50',
    green: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition-colors disabled:cursor-default disabled:opacity-50 ${tones[tone]}`}
    >
      {icon}
      {label}
    </button>
  );
}
