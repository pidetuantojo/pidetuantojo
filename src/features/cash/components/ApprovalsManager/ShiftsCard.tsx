'use client';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth';
import { formatBogotaDateTime } from '@/lib/shared/bogotaDate';

import { cashierLabel } from '../../helpers/approvals.helpers';
import { shiftStatusLabel } from '../../helpers/shift.helpers';
import type { ShiftRow, ShiftStatus } from '../../types/cash.types';
import { CashCard } from '../CashLayout';

export const SHIFT_FILTER_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'ABIERTO', label: 'Abiertos' },
  { value: 'EN_CIERRE', label: 'En cierre' },
  { value: 'CERRADO_PENDIENTE_APROBACION', label: 'Pendientes de aprobación' },
  { value: 'CERRADO', label: 'Cerrados' },
];

interface ShiftsCardProps {
  title: string;
  shifts: readonly ShiftRow[];
  registerName: (registerId: string) => string;
  emptyText: string;
  onReview: (shift: ShiftRow) => void;
  /** Muestra el filtro por estado (lista de turnos recientes). */
  filter?: { value: ShiftStatus | ''; onChange: (value: ShiftStatus | '') => void };
}

/** Lista de turnos con acceso al detalle de cierre; sirve para pendientes y para recientes. */
export function ShiftsCard({
  title,
  shifts,
  registerName,
  emptyText,
  onReview,
  filter,
}: ShiftsCardProps) {
  const { user } = useAuth();
  return (
    <CashCard
      title={title}
      actions={
        filter && (
          <div className="w-56">
            <Select
              value={filter.value}
              onChange={(v) => filter.onChange(v as ShiftStatus | '')}
              options={SHIFT_FILTER_OPTIONS}
              compact
            />
          </div>
        )
      }
    >
      {shifts.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--t-text-3)]">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-[var(--t-border)]">
          {shifts.map((shift) => (
            <li key={shift.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--t-text-1)]">
                  {registerName(shift.registerId)}
                </p>
                <p className="text-xs text-[var(--t-text-3)]">
                  {cashierLabel(shift.cashierUid, user?.uid)} ·{' '}
                  {formatBogotaDateTime(shift.openedAt)} · {shiftStatusLabel(shift.status)}
                </p>
              </div>
              {(shift.status === 'CERRADO_PENDIENTE_APROBACION' || shift.status === 'CERRADO') && (
                <Button size="sm" variant="secondary" onClick={() => onReview(shift)}>
                  {shift.status === 'CERRADO' ? 'Ver cierre' : 'Revisar'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </CashCard>
  );
}
