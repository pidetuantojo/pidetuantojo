'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface Props {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
  isActive?: boolean;
  onApply: (from: string, to: string) => void;
}

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDaysGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = (firstDay + 6) % 7; // convert to Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  // pad to full rows
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function fmt(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export function DateRangePicker({ from, to, isActive, onApply }: Props) {
  const today = new Date();
  const todayYMD = toYMD(today);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selFrom, setSelFrom] = useState(from);
  const [selTo, setSelTo] = useState(to);
  const [hovered, setHovered] = useState<string | null>(null);

  const ref = useRef<HTMLDivElement>(null);

  // Sync props → internal state when picker opens
  useEffect(() => {
    if (open) {
      setSelFrom(from);
      setSelTo(to);
    }
  }, [open, from, to]);

  // Click outside → close
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

  function handleDayClick(d: Date) {
    const ymd = toYMD(d);
    if (!selFrom || (selFrom && selTo)) {
      setSelFrom(ymd);
      setSelTo('');
    } else {
      if (ymd < selFrom) {
        setSelTo(selFrom);
        setSelFrom(ymd);
      } else if (ymd === selFrom) {
        setSelTo(ymd);
      } else {
        setSelTo(ymd);
      }
    }
  }

  function handleApply() {
    if (!selFrom || !selTo) return;
    onApply(selFrom, selTo);
    setOpen(false);
  }

  function handleClear() {
    setSelFrom('');
    setSelTo('');
  }

  const effTo = selTo || hovered || '';

  function isStart(ymd: string) { return ymd === selFrom; }
  function isEnd(ymd: string)   { return ymd === selTo; }
  function inRange(ymd: string) {
    if (!selFrom || !effTo) return false;
    const lo = selFrom <= effTo ? selFrom : effTo;
    const hi = selFrom <= effTo ? effTo : selFrom;
    return ymd > lo && ymd < hi;
  }

  const label = from && to ? `${fmt(from)} – ${fmt(to)}` : 'Personalizado';
  const days = getDaysGrid(viewYear, viewMonth);
  const canApply = !!(selFrom && selTo);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`btn btn-sm gap-1.5 ${isActive ? 'text-white border-0' : 'btn-ghost border-base-300'}`}
        style={isActive ? { background: '#FF6A1A' } : {}}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        {label}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 rounded-2xl bg-white shadow-2xl"
          style={{ width: 296, border: '1px solid #E5E7EB' }}
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <button onClick={prevMonth} className="btn btn-ghost btn-xs btn-circle">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="btn btn-ghost btn-xs btn-circle">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3 mb-1">
            {WEEKDAYS.map(wd => (
              <div key={wd} className="text-center text-xs font-semibold py-1" style={{ color: '#9CA3AF' }}>
                {wd}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 px-3 gap-y-0.5 pb-2">
            {days.map((d, i) => {
              if (!d) return <div key={`e-${i}`} />;
              const ymd = toYMD(d);
              const start = isStart(ymd);
              const end = isEnd(ymd);
              const inR = inRange(ymd);
              const isTodayDay = ymd === todayYMD;
              const isFuture = ymd > todayYMD;

              return (
                <button
                  key={ymd}
                  onClick={() => !isFuture && handleDayClick(d)}
                  onMouseEnter={() => selFrom && !selTo && !isFuture && setHovered(ymd)}
                  onMouseLeave={() => setHovered(null)}
                  disabled={isFuture}
                  style={{
                    height: 34,
                    borderRadius: start || end ? 8 : inR ? 0 : 8,
                    background: start || end ? '#FF6A1A' : inR ? '#FFF3E8' : 'transparent',
                    color: start || end ? '#fff' : inR ? '#C2440F' : isFuture ? '#D1D5DB' : '#111827',
                    border: 'none',
                    cursor: isFuture ? 'not-allowed' : 'pointer',
                    fontWeight: isTodayDay ? 700 : 500,
                    fontSize: 13,
                    position: 'relative',
                    transition: 'background .1s',
                  }}
                  className={!start && !end && !inR && !isFuture ? 'hover:bg-gray-100' : ''}
                >
                  {d.getDate()}
                  {isTodayDay && !start && !end && (
                    <span style={{
                      position: 'absolute', bottom: 3, left: '50%',
                      transform: 'translateX(-50%)',
                      width: 4, height: 4, borderRadius: '50%',
                      background: '#FF6A1A', display: 'block',
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid #F3F4F6' }}
          >
            <button
              onClick={handleClear}
              className="btn btn-ghost btn-xs text-gray-400 hover:text-gray-600"
            >
              Borrar
            </button>
            {selFrom && !selTo && (
              <span className="text-xs text-gray-400">Seleccioná la fecha fin</span>
            )}
            <button
              onClick={handleApply}
              disabled={!canApply}
              className="btn btn-sm disabled:opacity-30"
              style={{ background: '#FF6A1A', color: '#fff', border: 'none' }}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
