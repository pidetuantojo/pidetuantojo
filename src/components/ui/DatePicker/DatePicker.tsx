'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

const sg = 'var(--font-sans, sans-serif)';
const ORANGE = '#FF6A1A';
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaysGrid(year: number, month: number): (Date | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function fmtDisplay(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface DatePickerProps {
  value: string;        // YYYY-MM-DD
  onChange: (ymd: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DatePicker({ value, onChange, disabled, placeholder = 'Seleccionar fecha' }: DatePickerProps) {
  const today = new Date();
  const todayYMD = toYMD(today);

  const initYear = value ? Number(value.slice(0, 4)) : today.getFullYear();
  const initMonth = value ? Number(value.slice(5, 7)) - 1 : today.getMonth();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && value) {
      setViewYear(Number(value.slice(0, 4)));
      setViewMonth(Number(value.slice(5, 7)) - 1);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const days = getDaysGrid(viewYear, viewMonth);

  return (
    <div style={{ position: 'relative', fontFamily: sg }} ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 14px', borderRadius: 12, textAlign: 'left',
          border: `1.5px solid ${open ? ORANGE : 'var(--t-input-border)'}`,
          background: disabled ? 'var(--t-surface-2)' : 'var(--t-input-bg)',
          color: value ? 'var(--t-text-1)' : 'var(--t-text-4)',
          fontSize: 14, fontFamily: sg, cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: open ? `0 0 0 4px rgba(255,106,26,.13)` : 'none',
          transition: 'border-color .15s, box-shadow .15s', outline: 'none',
        }}
      >
        <CalendarDays size={15} color={value ? ORANGE : 'var(--t-text-3)'} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{value ? fmtDisplay(value) : placeholder}</span>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--t-text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          width: 284, background: 'var(--t-surface)', borderRadius: 16,
          border: '1.5px solid var(--t-border)', boxShadow: '0 8px 32px -8px rgba(0,0,0,.22)',
        }}>
          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 8px' }}>
            <button type="button" onClick={prevMonth} style={navBtn}>
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-1)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} style={navBtn}>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 10px', marginBottom: 2 }}>
            {WEEKDAYS.map(wd => (
              <div key={wd} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--t-text-3)', padding: '4px 0' }}>
                {wd}
              </div>
            ))}
          </div>

          {/* Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 10px 10px', gap: '2px 0' }}>
            {days.map((d, i) => {
              if (!d) return <div key={`e-${i}`} />;
              const ymd = toYMD(d);
              const isSelected = ymd === value;
              const isToday = ymd === todayYMD;
              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => { onChange(ymd); setOpen(false); }}
                  style={{
                    height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                    fontWeight: isToday ? 700 : 400,
                    background: isSelected ? ORANGE : 'transparent',
                    color: isSelected ? '#fff' : 'var(--t-text-1)',
                    position: 'relative',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--t-surface-2)'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {d.getDate()}
                  {isToday && !isSelected && (
                    <span style={{
                      position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                      width: 4, height: 4, borderRadius: '50%', background: ORANGE, display: 'block',
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--t-border-2)' }}>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              style={{ fontFamily: sg, fontSize: 12, fontWeight: 600, color: 'var(--t-text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => { onChange(todayYMD); setOpen(false); }}
              style={{ fontFamily: sg, fontSize: 12, fontWeight: 600, color: ORANGE, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--t-border-2)', borderRadius: 8,
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: 'var(--t-text-2)',
};
