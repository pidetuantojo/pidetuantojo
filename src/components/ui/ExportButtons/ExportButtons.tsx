'use client';

import { Button } from '@/components/ui/Button';

interface ExportButtonsProps {
  /** Sin permiso de exportar no se dibuja nada. */
  canExport: boolean;
  disabled?: boolean;
  onExcel: () => void;
  onCsv: () => void;
}

/** Par de botones "Excel" / "CSV" para descargar el reporte que se está viendo. */
export function ExportButtons({ canExport, disabled, onExcel, onCsv }: ExportButtonsProps) {
  if (!canExport) return null;
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={onExcel} disabled={disabled}>
        Exportar Excel
      </Button>
      <Button variant="secondary" size="sm" onClick={onCsv} disabled={disabled}>
        Exportar CSV
      </Button>
    </div>
  );
}
