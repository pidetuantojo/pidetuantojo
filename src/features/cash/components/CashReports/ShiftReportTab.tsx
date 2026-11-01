'use client';

import { useMemo, useState } from 'react';

import { ExportButtons } from '@/components/ui/ExportButtons';
import { Select } from '@/components/ui/Select';
import { formatBogotaDateTime } from '@/lib/shared/bogotaDate';
import { formatCOP } from '@/lib/shared/money';

import { downloadCsv, downloadXlsx, shiftRows } from '../../helpers/reports.export';
import { METHOD_TYPE_LABELS, shiftStatusLabel } from '../../helpers/shift.helpers';
import { useShiftReport } from '../../hooks/useCashReports';
import { useRegisters, useShifts } from '../../hooks/useCashQueries';
import { CashCard, CashNotice } from '../CashLayout';
import { MovementsList } from '../MovementsList';

export function ShiftReportTab({ restaurantId }: { restaurantId: string }) {
  const shifts = useShifts(restaurantId, undefined);
  const registers = useRegisters(restaurantId);
  const [shiftId, setShiftId] = useState('');
  const query = useShiftReport(restaurantId, shiftId);
  const report = query.data;

  const options = useMemo(() => {
    const nameOf = (id: string) => registers.data?.find((r) => r.id === id)?.name ?? 'Caja';
    return (shifts.data ?? []).map((s) => ({
      value: s.id,
      label: `${nameOf(s.registerId)} · ${formatBogotaDateTime(s.openedAt)} · ${shiftStatusLabel(s.status)}`,
    }));
  }, [shifts.data, registers.data]);

  function exportAs(kind: 'xlsx' | 'csv') {
    if (!report) return;
    const name = `cierre-turno-${report.shift.id}.${kind}`;
    if (kind === 'xlsx') downloadXlsx(shiftRows(report), name, 'Cierre de turno');
    else downloadCsv(shiftRows(report), name);
  }

  const closing = report?.closing;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-96 max-w-full">
          <Select
            label="Turno"
            value={shiftId}
            onChange={setShiftId}
            options={options}
            placeholder="Elegí un turno reciente"
            searchable
          />
        </div>
        <div className="ml-auto">
          <ExportButtons
            canExport
            disabled={!report}
            onExcel={() => exportAs('xlsx')}
            onCsv={() => exportAs('csv')}
          />
        </div>
      </div>
      {query.isLoading && <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>}
      {query.isError && <CashNotice tone="danger">No se pudo cargar el reporte.</CashNotice>}
      {report && (
        <>
          <CashCard
            title={`${report.register?.name ?? 'Caja'} · ${shiftStatusLabel(report.shift.status)}`}
          >
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <dt className="text-[var(--t-text-3)]">Cajero</dt>
              <dd className="text-[var(--t-text-1)]">{report.cashierUid}</dd>
              <dt className="text-[var(--t-text-3)]">Apertura</dt>
              <dd className="text-[var(--t-text-1)]">
                {formatBogotaDateTime(report.shift.openedAt)} · base{' '}
                {formatCOP(report.openingTotal)}
              </dd>
              {report.approval && (
                <>
                  <dt className="text-[var(--t-text-3)]">Aprobación</dt>
                  <dd className="text-[var(--t-text-1)]">
                    {report.approval.approvedBy} ·{' '}
                    {formatBogotaDateTime(report.approval.approvedAt)}
                    {report.approval.note ? ` · ${report.approval.note}` : ''}
                  </dd>
                </>
              )}
            </dl>
          </CashCard>

          {closing && (
            <CashCard title="Cierre">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[var(--t-text-3)]">
                    <th className="py-2 pr-3 font-semibold">Medio</th>
                    <th className="py-2 pr-3 text-right font-semibold">Esperado</th>
                    <th className="py-2 pr-3 text-right font-semibold">Declarado</th>
                    <th className="py-2 text-right font-semibold">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--t-border)] text-[var(--t-text-1)]">
                  {(
                    Object.keys(closing.expectedByMethod) as (keyof typeof METHOD_TYPE_LABELS)[]
                  ).map((method) => (
                    <tr key={method}>
                      <td className="py-2 pr-3">{METHOD_TYPE_LABELS[method]}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCOP(closing.expectedByMethod[method] ?? 0)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCOP(closing.declaredByMethod[method] ?? 0)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCOP(closing.differenceByMethod[method] ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-sm text-[var(--t-text-2)]">
                Efectivo contado: {formatCOP(closing.countedCash)} · diferencia en efectivo:{' '}
                {formatCOP(closing.cashDifference)}
              </p>
            </CashCard>
          )}

          <CashCard title="Movimientos del turno">
            <MovementsList movements={report.movements} />
          </CashCard>
          <CashCard title="Asientos contables">
            <p className="font-mono text-sm text-[var(--t-text-1)]">
              {report.journalEntryNumbers.length > 0
                ? report.journalEntryNumbers.join(', ')
                : 'Sin asientos'}
            </p>
          </CashCard>
        </>
      )}
    </div>
  );
}
