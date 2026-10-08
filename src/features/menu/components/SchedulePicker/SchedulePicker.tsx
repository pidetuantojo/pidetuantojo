'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { OpeningHours } from '@/types';
import {
  getDaySchedule,
  getScheduleBounds,
  hasOpeningHours,
  isWithinOpeningHours,
  toDateInputValue,
} from '../../helpers/schedule.helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_LABELS  = ['LU','MA','MI','JU','VI','SA','DO'];

/** Genera el grid del mes: semanas, cada una con 7 slots (null = día de otro mes). */
function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  // Monday-first: getDay() 0=Dom→6, 1=Lun→0, ...
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** Slots de tiempo cada 15 min para un día dado. Filtra los que estén dentro del rango y horario. */
function buildTimeSlots(
  selectedDate: Date | null,
  minDate: Date,
  maxDate: Date,
  openingHours: OpeningHours | undefined,
): string[] {
  if (!selectedDate) return [];
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const candidate = new Date(selectedDate);
      candidate.setHours(h, m, 0, 0);
      if (candidate < minDate || candidate > maxDate) continue;
      if (hasOpeningHours(openingHours) && !isWithinOpeningHours(openingHours, candidate)) continue;
      slots.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return slots;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  date: string;          // "YYYY-MM-DD"
  time: string;          // "HH:mm"
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  openingHours?: OpeningHours;
  primaryColor: string;
  secondaryColor: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SchedulePicker({ date, time, onDateChange, onTimeChange, openingHours, primaryColor }: Props) {
  const now = new Date();
  const { min: minDate, max: maxDate } = getScheduleBounds(now);

  // Mes visible en el calendario
  const [viewYear,  setViewYear]  = useState(() => now.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => now.getMonth());

  const selectedDate = useMemo(() => {
    if (!date) return null;
    const [y, mo, d] = date.split('-').map(Number);
    return new Date(y, mo - 1, d);
  }, [date]);

  const grid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const timeSlots = useMemo(
    () => buildTimeSlots(selectedDate, minDate, maxDate, openingHours),
    [selectedDate, minDate, maxDate, openingHours],
  );

  // Horas disponibles (sin duplicados, en orden)
  const availableHours = useMemo(() => {
    const seen = new Set<string>();
    return timeSlots
      .map((s) => s.split(':')[0])
      .filter((h) => (seen.has(h) ? false : (seen.add(h), true)));
  }, [timeSlots]);

  const selectedHour = time ? time.split(':')[0] : '';
  const selectedMinute = time ? time.split(':')[1] : '';

  // Minutos válidos para la hora seleccionada
  const minutesForHour = useMemo(
    () => timeSlots.filter((s) => s.startsWith(selectedHour + ':')).map((s) => s.split(':')[1]),
    [timeSlots, selectedHour],
  );

  function handleHourChange(h: string) {
    // Auto-seleccionar el primer minuto disponible para esa hora
    const firstMin = timeSlots.find((s) => s.startsWith(h + ':'))?.split(':')[1] ?? '';
    onTimeChange(firstMin ? `${h}:${firstMin}` : '');
  }

  function handleMinuteChange(m: string) {
    onTimeChange(`${selectedHour}:${m}`);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function isDayDisabled(day: Date): boolean {
    // Fuera del rango
    const dayStart = new Date(day); dayStart.setHours(0,  0,  0, 0);
    const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999);
    if (dayEnd < minDate || dayStart > maxDate) return true;
    // Restaurante cerrado ese día (si tiene horario configurado)
    if (hasOpeningHours(openingHours) && !getDaySchedule(openingHours, day)) return true;
    return false;
  }

  function selectDay(day: Date) {
    if (isDayDisabled(day)) return;
    onDateChange(toDateInputValue(day));
    onTimeChange(''); // Reset hora cuando cambia el día
  }

  const hasSlots = timeSlots.length > 0;
  const noSlotsMsg = selectedDate && !hasSlots
    ? 'No hay horarios disponibles para este día.'
    : null;

  // Paleta para fondo claro
  const textMain     = '#1a1a1a';
  const textMuted    = '#6b7280';
  const textDisabled = '#d1d5db';
  const borderColor  = '#e5e7eb';
  const bgCard       = '#ffffff';
  const bgHover      = '#f3f4f6';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Calendario ── */}
      <div style={{ background: bgCard, borderRadius: 16, overflow: 'hidden', border: `1px solid ${borderColor}`, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>

        {/* Nav mes */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${borderColor}` }}>
          <button
            type="button"
            onClick={prevMonth}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${borderColor}`, background: bgCard, color: textMuted, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: textMain, letterSpacing: '-.01em' }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${borderColor}`, background: bgCard, color: textMuted, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ padding: '10px 10px 12px' }}>
          {/* Encabezados días */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
            {DAY_LABELS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: textMuted, padding: '3px 0', letterSpacing: '.04em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid días */}
          {grid.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px 0' }}>
              {week.map((day, di) => {
                if (!day) return <div key={di} />;
                const isSelected  = selectedDate ? sameDay(day, selectedDate) : false;
                const isToday     = sameDay(day, now);
                const isDisabled  = isDayDisabled(day);
                return (
                  <button
                    key={di}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectDay(day)}
                    style={{
                      height: 38,
                      borderRadius: 10,
                      border: isToday && !isSelected ? `1.5px solid ${primaryColor}` : '1.5px solid transparent',
                      background: isSelected ? primaryColor : 'transparent',
                      color: isDisabled ? textDisabled : isSelected ? '#fff' : textMain,
                      fontWeight: isSelected || isToday ? 700 : 400,
                      fontSize: 13,
                      cursor: isDisabled ? 'default' : 'pointer',
                      textDecoration: 'none',
                      transition: 'background .12s',
                    }}
                    onPointerEnter={(e) => { if (!isDisabled && !isSelected) (e.currentTarget as HTMLButtonElement).style.background = bgHover; }}
                    onPointerLeave={(e) => { if (!isDisabled && !isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Selector de hora ── */}
      {selectedDate && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: textMain }}>
            Hora del pedido
          </p>

          {noSlotsMsg ? (
            <p style={{ margin: 0, fontSize: 13, color: textMuted, fontStyle: 'italic' }}>{noSlotsMsg}</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Select hora */}
              <select
                value={selectedHour}
                onChange={(e) => handleHourChange(e.target.value)}
                style={{
                  flex: 1, fontSize: 14, fontWeight: 500, color: selectedHour ? textMain : textMuted,
                  border: `1.5px solid ${selectedHour ? primaryColor : borderColor}`,
                  borderRadius: 10, padding: '10px 12px', background: bgCard,
                  outline: 'none', cursor: 'pointer', appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                  paddingRight: 32, transition: 'border-color .15s',
                }}
              >
                <option value="">Hora</option>
                {availableHours.map((h) => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>

              <span style={{ fontSize: 18, fontWeight: 700, color: textMuted, flexShrink: 0 }}>:</span>

              {/* Select minutos */}
              <select
                value={selectedMinute}
                disabled={!selectedHour}
                onChange={(e) => handleMinuteChange(e.target.value)}
                style={{
                  flex: 1, fontSize: 14, fontWeight: 500, color: selectedMinute ? textMain : textMuted,
                  border: `1.5px solid ${selectedMinute ? primaryColor : borderColor}`,
                  borderRadius: 10, padding: '10px 12px', background: bgCard,
                  outline: 'none', cursor: selectedHour ? 'pointer' : 'default',
                  appearance: 'none', opacity: selectedHour ? 1 : 0.45,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                  paddingRight: 32, transition: 'border-color .15s, opacity .15s',
                }}
              >
                <option value="">Min</option>
                {minutesForHour.map((m) => (
                  <option key={m} value={m}>:{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
