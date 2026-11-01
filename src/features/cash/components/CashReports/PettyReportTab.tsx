'use client';

import { useMemo, useState } from 'react';

import { DateRangePicker } from '@/components/ui/DateRangePicker/DateRangePicker';
import { ExportButtons } from '@/components/ui/ExportButtons';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth';
import { currentMonthRange } from '@/features/ledger/helpers/range.helpers';
import { formatBogotaDateTime } from '@/lib/shared/bogotaDate';
import { formatCOP } from '@/lib/shared/money';

import { downloadCsv, downloadXlsx, pettyRows } from '../../helpers/reports.export';
import { useRegisters } from '../../hooks/useCashQueries';
import { usePettyReport } from '../../hooks/useCashReports';
import { CashCard, CashNotice } from '../CashLayout';

export function PettyReportTab({ restaurantId }: { restaurantId: string }) {
  const { can } = useAuth();
  const registers = useRegisters(restaurantId);
  const [registerId, setRegisterId] = useState('');
  const [range, setRange] = useState(currentMonthRange);
  const allowed = can('petty_cash.manage');
  const query = usePettyReport(restaurantId, allowed ? registerId : '', range.from, range.to);
  const report = query.data;

  const options = useMemo(
    () =>
      (registers.data ?? [])
        .filter((r) => r.type === 'MENOR')
        .map((r) => ({ value: r.id, label: r.name })),
    [registers.data]
  );

  if (!allowed) {
    return (
      <CashNotice tone="warning">
        El estado de caja menor requiere el permiso &quot;Operar caja menor&quot;.
      </CashNotice>
    );
  }

  function exportAs(kind: 'xlsx' | 'csv') {
    if (!report) return;
    const name = `caja-menor-${range.from}_${range.to}.${kind}`;
    if (kind === 'xlsx') downloadXlsx(pettyRows(report), name, 'Caja menor');
    else downloadCsv(pettyRows(report), name);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64 max-w-full">
          <Select
            label="Caja menor"
            value={registerId}
            onChange={setRegisterId}
            options={options}
            placeholder="Elegí una caja menor"
          />
        </div>
        <DateRangePicker
          from={range.from}
          to={range.to}
          isActive
          onApply={(from, to) => setRange({ from, to })}
        />
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
          <CashCard title="Estado del fondo">
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <dt className="text-[var(--t-text-3)]">Fondo</dt>
              <dd className="text-[var(--t-text-1)]">{formatCOP(report.status.fundAmount)}</dd>
              <dt className="text-[var(--t-text-3)]">Efectivo en caja</dt>
              <dd className="text-[var(--t-text-1)]">{formatCOP(report.status.cashOnHand)}</dd>
              <dt className="text-[var(--t-text-3)]">Vales pendientes</dt>
              <dd className="text-[var(--t-text-1)]">
                {formatCOP(report.status.pendingVouchersTotal)}
              </dd>
              <dt className="text-[var(--t-text-3)]">Efectivo + vales = fondo</dt>
              <dd className={report.status.invariantOk ? 'text-emerald-600' : 'text-red-500'}>
                {report.status.invariantOk ? 'Cuadra' : 'No cuadra'}
              </dd>
            </dl>
          </CashCard>
          <CashCard title="Gastos del rango por categoría y estado">
            {report.expensesByCategory.length === 0 ? (
              <p className="text-sm text-[var(--t-text-3)]">Sin gastos en el rango.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-[var(--t-border)] text-[var(--t-text-1)]">
                  {report.expensesByCategory.map((g) => (
                    <tr key={`${g.categoryId}-${g.status}`}>
                      <td className="py-2 pr-3">{g.categoryName}</td>
                      <td className="py-2 pr-3">{g.status}</td>
                      <td className="py-2 pr-3 text-right">{g.count}</td>
                      <td className="py-2 text-right tabular-nums">{formatCOP(g.total)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2 pr-3" colSpan={3}>
                      Total
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(report.expensesTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </CashCard>
          <CashCard title="Reembolsos del rango">
            {report.reimbursements.length === 0 ? (
              <p className="text-sm text-[var(--t-text-3)]">Sin reembolsos en el rango.</p>
            ) : (
              <ul className="divide-y divide-[var(--t-border)] text-sm text-[var(--t-text-1)]">
                {report.reimbursements.map((r) => (
                  <li key={r.id} className="flex justify-between py-2">
                    <span>
                      {formatBogotaDateTime(r.requestedAt)} · {r.status} · {r.expenseIds.length}{' '}
                      vales
                    </span>
                    <span className="tabular-nums">{formatCOP(r.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CashCard>
        </>
      )}
    </div>
  );
}
