// Exportación de los reportes de caja: filas planas (encabezados en español, montos enteros).
import type { DailySummary, PettyReport, ShiftReport } from '@/lib/cash/reports.types';
import { formatBogotaDateTime } from '@/lib/shared/bogotaDate';
import { downloadCsv, downloadXlsx, type ExportRow } from '@/lib/shared/tabularExport';

import { METHOD_TYPE_LABELS, movementStatusLabel, movementTypeLabel } from './shift.helpers';

export { downloadCsv, downloadXlsx };
export type { ExportRow };

/** Resumen diario: por caja y medio de pago, y luego los totales del restaurante (sin espejos). */
export function dailyRows(summary: DailySummary): ExportRow[] {
  const perRegister = summary.registers.flatMap((r) =>
    r.methods.map((m) => ({
      Fecha: summary.date,
      Ámbito: r.name,
      Medio: METHOD_TYPE_LABELS[m.methodType],
      Entradas: m.in,
      Salidas: m.out,
      Neto: m.net,
      Movimientos: m.count,
      'Entradas por espejo': m.mirrorIn,
      'Salidas por espejo': m.mirrorOut,
    }))
  );
  const restaurant = summary.restaurantTotals.methods.map((m) => ({
    Fecha: summary.date,
    Ámbito: 'TOTAL RESTAURANTE (sin espejos)',
    Medio: METHOD_TYPE_LABELS[m.methodType],
    Entradas: m.in,
    Salidas: m.out,
    Neto: m.net,
    Movimientos: m.count,
    'Entradas por espejo': 0,
    'Salidas por espejo': 0,
  }));
  return [...perRegister, ...restaurant];
}

/** Cierre por turno: un renglón por movimiento del turno. */
export function shiftRows(report: ShiftReport): ExportRow[] {
  return report.movements.map((m) => ({
    Caja: report.register?.name ?? '',
    Turno: report.shift.id,
    Cajero: report.cashierUid,
    'Fecha y hora': formatBogotaDateTime(m.createdAt),
    'Día contable': m.accountingDate,
    Comprobante: m.receiptNumber,
    Tipo: movementTypeLabel(m.type),
    Sentido: m.direction === 'IN' ? 'Entrada' : 'Salida',
    Medio: METHOD_TYPE_LABELS[m.methodType],
    Monto: m.amount,
    Estado: movementStatusLabel(m.status),
    Motivo: m.reason ?? '',
  }));
}

/** Caja menor: gastos agrupados por categoría y estado, y los reembolsos del rango. */
export function pettyRows(report: PettyReport): ExportRow[] {
  const expenses = report.expensesByCategory.map((g) => ({
    Sección: 'Gastos',
    Detalle: g.categoryName,
    Estado: g.status,
    Cantidad: g.count,
    Total: g.total,
  }));
  const reimbursements = report.reimbursements.map((r) => ({
    Sección: 'Reembolsos',
    Detalle: formatBogotaDateTime(r.requestedAt),
    Estado: r.status,
    Cantidad: r.expenseIds.length,
    Total: r.total,
  }));
  return [...expenses, ...reimbursements];
}
