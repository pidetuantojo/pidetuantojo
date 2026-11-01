'use client';

import type { ReactNode } from 'react';

import { DateRangePicker } from '@/components/ui/DateRangePicker/DateRangePicker';
import { ExportButtons } from '@/components/ui/ExportButtons/ExportButtons';

import type { DateRangeValue } from '../../types/ledger.types';

interface ReportToolbarProps {
  range: DateRangeValue;
  onRangeChange: (range: DateRangeValue) => void;
  canExport: boolean;
  exportDisabled?: boolean;
  onExcel: () => void;
  onCsv: () => void;
  /** Controles propios del reporte (p. ej. selector de cuenta). */
  children?: ReactNode;
}

/** Barra de un reporte: rango de fechas, controles propios y exportación. */
export function ReportToolbar({
  range,
  onRangeChange,
  canExport,
  exportDisabled,
  onExcel,
  onCsv,
  children,
}: ReportToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {children}
      <DateRangePicker
        from={range.from}
        to={range.to}
        isActive
        onApply={(from, to) => onRangeChange({ from, to })}
      />
      <div className="ml-auto">
        <ExportButtons
          canExport={canExport}
          disabled={exportDisabled}
          onExcel={onExcel}
          onCsv={onCsv}
        />
      </div>
    </div>
  );
}
