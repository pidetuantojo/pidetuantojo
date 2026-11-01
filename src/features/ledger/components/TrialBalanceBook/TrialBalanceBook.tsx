'use client';

import { useState } from 'react';

import { useAuth } from '@/features/auth';
import { CashCard, CashNotice, CashPageHeader } from '@/features/cash/components/CashLayout';
import { formatCOP } from '@/lib/shared/money';

import {
  downloadCsv,
  downloadXlsx,
  exportFilename,
  trialBalanceRows,
} from '../../helpers/export.helpers';
import { NATURE_LABELS } from '../../helpers/ledger-labels.helpers';
import { currentMonthRange } from '../../helpers/range.helpers';
import { useTrialBalance } from '../../hooks/useLedgerQueries';
import { LedgerModuleGate } from '../LedgerModuleGate';
import { LedgerNav } from '../LedgerNav';
import { ReportToolbar } from '../ReportToolbar';

function TrialBalanceView({ restaurantId }: { restaurantId: string }) {
  const { can } = useAuth();
  const [range, setRange] = useState(currentMonthRange);
  const query = useTrialBalance(restaurantId, range.from, range.to);
  const report = query.data;

  function exportAs(kind: 'xlsx' | 'csv') {
    if (!report) return;
    const name = exportFilename('balance-comprobacion', range.from, range.to, kind);
    if (kind === 'xlsx') downloadXlsx(trialBalanceRows(report), name, 'Balance');
    else downloadCsv(trialBalanceRows(report), name);
  }

  return (
    <div className="space-y-4">
      <ReportToolbar
        range={range}
        onRangeChange={setRange}
        canExport={can('ledger.export')}
        exportDisabled={!report}
        onExcel={() => exportAs('xlsx')}
        onCsv={() => exportAs('csv')}
      />
      {query.isLoading && <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>}
      {query.isError && (
        <CashNotice tone="danger">No se pudo cargar el balance de comprobación.</CashNotice>
      )}
      {report && (
        <CashCard>
          {!report.balanced && (
            <div className="mb-3">
              <CashNotice tone="danger" title="El balance no cuadra">
                Los débitos y los créditos del período difieren. Avisá a soporte.
              </CashNotice>
            </div>
          )}
          {report.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--t-text-3)]">
              No hay movimientos ni saldos en este rango.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[var(--t-text-3)]">
                    <th className="py-2 pr-3 font-semibold">Código</th>
                    <th className="py-2 pr-3 font-semibold">Cuenta</th>
                    <th className="py-2 pr-3 font-semibold">Naturaleza</th>
                    <th className="py-2 pr-3 text-right font-semibold">Saldo inicial</th>
                    <th className="py-2 pr-3 text-right font-semibold">Débitos</th>
                    <th className="py-2 pr-3 text-right font-semibold">Créditos</th>
                    <th className="py-2 text-right font-semibold">Saldo final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--t-border)] text-[var(--t-text-1)]">
                  {report.rows.map((row) => (
                    <tr key={row.accountId}>
                      <td className="py-2 pr-3 font-mono">{row.code}</td>
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 pr-3">{NATURE_LABELS[row.nature]}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCOP(row.opening)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatCOP(row.debit)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatCOP(row.credit)}</td>
                      <td className="py-2 text-right tabular-nums">{formatCOP(row.closing)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold text-[var(--t-text-1)]">
                    <td className="pr-3 pt-3" colSpan={4}>
                      Totales del período
                    </td>
                    <td className="pr-3 pt-3 text-right tabular-nums">
                      {formatCOP(report.totalDebit)}
                    </td>
                    <td className="pr-3 pt-3 text-right tabular-nums">
                      {formatCOP(report.totalCredit)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CashCard>
      )}
    </div>
  );
}

/** Balance de comprobación: saldo inicial, movimientos y saldo final por cuenta. */
export function TrialBalanceBook() {
  return (
    <LedgerModuleGate permission="ledger.view">
      {(restaurantId) => (
        <div className="space-y-5">
          <CashPageHeader
            title="Libros contables"
            description="Balance de comprobación: la suma de débitos debe ser igual a la de créditos."
          />
          <LedgerNav />
          <TrialBalanceView restaurantId={restaurantId} />
        </div>
      )}
    </LedgerModuleGate>
  );
}
