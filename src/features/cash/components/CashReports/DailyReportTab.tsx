'use client';

import { useState } from 'react';

import { DatePicker } from '@/components/ui/DatePicker/DatePicker';
import { ExportButtons } from '@/components/ui/ExportButtons';
import { toAccountingDate } from '@/lib/shared/bogotaDate';
import { formatCOP } from '@/lib/shared/money';

import { dailyRows, downloadCsv, downloadXlsx } from '../../helpers/reports.export';
import { METHOD_TYPE_LABELS } from '../../helpers/shift.helpers';
import { useDailySummary } from '../../hooks/useCashReports';
import { CashCard, CashNotice } from '../CashLayout';

const th = 'py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-[var(--t-text-3)]';
const num = 'py-2 pr-3 text-right tabular-nums';

export function DailyReportTab({ restaurantId }: { restaurantId: string }) {
  const [date, setDate] = useState(() => toAccountingDate(new Date()));
  const query = useDailySummary(restaurantId, date);
  const summary = query.data;

  function exportAs(kind: 'xlsx' | 'csv') {
    if (!summary) return;
    const name = `resumen-diario-${date}.${kind}`;
    if (kind === 'xlsx') downloadXlsx(dailyRows(summary), name, 'Resumen diario');
    else downloadCsv(dailyRows(summary), name);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DatePicker value={date} onChange={setDate} />
        <div className="ml-auto">
          <ExportButtons
            canExport
            disabled={!summary}
            onExcel={() => exportAs('xlsx')}
            onCsv={() => exportAs('csv')}
          />
        </div>
      </div>
      {query.isLoading && <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>}
      {query.isError && <CashNotice tone="danger">No se pudo cargar el resumen diario.</CashNotice>}
      {summary && (
        <>
          <CashNotice>{summary.rule}</CashNotice>
          {summary.registers.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--t-text-3)]">
              No hubo movimientos aplicados este día.
            </p>
          )}
          {summary.registers.map((register) => (
            <CashCard key={register.registerId} title={register.name}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className={th}>Medio</th>
                    <th className={`${th} text-right`}>Entradas</th>
                    <th className={`${th} text-right`}>Salidas</th>
                    <th className={`${th} text-right`}>Neto</th>
                    <th className={`${th} text-right`}>Mov.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--t-border)] text-[var(--t-text-1)]">
                  {register.methods.map((m) => (
                    <tr key={m.methodType}>
                      <td className="py-2 pr-3">
                        {METHOD_TYPE_LABELS[m.methodType]}
                        {(m.mirrorIn > 0 || m.mirrorOut > 0) && (
                          <span className="ml-2 text-xs text-[var(--t-text-3)]">
                            (incluye espejos: {formatCOP(m.mirrorIn)} / {formatCOP(m.mirrorOut)})
                          </span>
                        )}
                      </td>
                      <td className={num}>{formatCOP(m.in)}</td>
                      <td className={num}>{formatCOP(m.out)}</td>
                      <td className={num}>{formatCOP(m.net)}</td>
                      <td className={num}>{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CashCard>
          ))}
          {summary.registers.length > 0 && (
            <CashCard title="Total del restaurante (sin espejos)">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-[var(--t-border)] text-[var(--t-text-1)]">
                  {summary.restaurantTotals.methods.map((m) => (
                    <tr key={m.methodType}>
                      <td className="py-2 pr-3">{METHOD_TYPE_LABELS[m.methodType]}</td>
                      <td className={num}>{formatCOP(m.in)}</td>
                      <td className={num}>{formatCOP(m.out)}</td>
                      <td className={num}>{formatCOP(m.net)}</td>
                      <td className={num}>{m.count}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2 pr-3">Total</td>
                    <td className={num}>{formatCOP(summary.restaurantTotals.in)}</td>
                    <td className={num}>{formatCOP(summary.restaurantTotals.out)}</td>
                    <td className={num}>{formatCOP(summary.restaurantTotals.net)}</td>
                    <td className={num}>{summary.restaurantTotals.count}</td>
                  </tr>
                </tbody>
              </table>
            </CashCard>
          )}
        </>
      )}
    </div>
  );
}
