'use client';

import { useMemo, useState } from 'react';

import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth';
import { CashCard, CashNotice, CashPageHeader } from '@/features/cash/components/CashLayout';
import { formatCOP } from '@/lib/shared/money';

import {
  downloadCsv,
  downloadXlsx,
  exportFilename,
  ledgerRows,
} from '../../helpers/export.helpers';
import { accountText, EVENT_LABELS, NATURE_LABELS } from '../../helpers/ledger-labels.helpers';
import { currentMonthRange } from '../../helpers/range.helpers';
import { useLedgerAccounts, useLedgerBook } from '../../hooks/useLedgerQueries';
import { LedgerModuleGate } from '../LedgerModuleGate';
import { LedgerNav } from '../LedgerNav';
import { ReportToolbar } from '../ReportToolbar';

function LedgerView({ restaurantId }: { restaurantId: string }) {
  const { can } = useAuth();
  const [range, setRange] = useState(currentMonthRange);
  const [accountId, setAccountId] = useState('');
  const accounts = useLedgerAccounts(restaurantId);
  const book = useLedgerBook(restaurantId, accountId, range.from, range.to);
  const report = book.data;

  const options = useMemo(
    () =>
      (accounts.data ?? [])
        .filter((a) => a.allowsMovements)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((a) => ({ value: a.id, label: accountText(a) })),
    [accounts.data]
  );

  function exportAs(kind: 'xlsx' | 'csv') {
    if (!report) return;
    const name = exportFilename(`mayor-${report.account.code}`, range.from, range.to, kind);
    if (kind === 'xlsx') downloadXlsx(ledgerRows(report), name, 'Libro mayor');
    else downloadCsv(ledgerRows(report), name);
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
      >
        <div className="w-72 max-w-full">
          <Select
            label="Cuenta"
            value={accountId}
            onChange={setAccountId}
            options={options}
            placeholder="Elegí una cuenta"
            searchable
          />
        </div>
      </ReportToolbar>

      {!accountId && (
        <p className="py-6 text-center text-sm text-[var(--t-text-3)]">
          Elegí una cuenta para ver su libro mayor.
        </p>
      )}
      {book.isLoading && <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>}
      {book.isError && <CashNotice tone="danger">No se pudo cargar el libro mayor.</CashNotice>}

      {report && (
        <CashCard
          title={accountText(report.account)}
          description={`Naturaleza ${NATURE_LABELS[report.account.nature].toLowerCase()} · saldo con el signo de su naturaleza`}
        >
          {report.truncated && (
            <div className="mb-3">
              <CashNotice tone="warning">
                El rango tiene demasiadas líneas: se muestran las primeras {report.lines.length}.
                Los totales y el saldo final sí incluyen todas. Acotá el rango para verlas todas.
              </CashNotice>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[var(--t-text-3)]">
                  <th className="py-2 pr-3 font-semibold">Fecha</th>
                  <th className="py-2 pr-3 font-semibold">Asiento</th>
                  <th className="py-2 pr-3 font-semibold">Evento</th>
                  <th className="py-2 pr-3 text-right font-semibold">Débito</th>
                  <th className="py-2 pr-3 text-right font-semibold">Crédito</th>
                  <th className="py-2 text-right font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--t-border)] text-[var(--t-text-1)]">
                <tr className="font-semibold">
                  <td className="py-2 pr-3" colSpan={5}>
                    Saldo inicial
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCOP(report.openingBalance)}
                  </td>
                </tr>
                {report.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-2 pr-3">{line.accountingDate}</td>
                    <td className="py-2 pr-3 font-mono">{line.entryNumber}</td>
                    <td className="py-2 pr-3">{EVENT_LABELS[line.event] ?? line.event}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {line.debit > 0 ? formatCOP(line.debit) : ''}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {line.credit > 0 ? formatCOP(line.credit) : ''}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatCOP(line.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold text-[var(--t-text-1)]">
                  <td className="pr-3 pt-3" colSpan={3}>
                    Totales y saldo final
                  </td>
                  <td className="pr-3 pt-3 text-right tabular-nums">
                    {formatCOP(report.totalDebit)}
                  </td>
                  <td className="pr-3 pt-3 text-right tabular-nums">
                    {formatCOP(report.totalCredit)}
                  </td>
                  <td className="pt-3 text-right tabular-nums">
                    {formatCOP(report.closingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CashCard>
      )}
    </div>
  );
}

/** Libro mayor de una cuenta: saldo inicial, movimientos con saldo corrido y saldo final. */
export function GeneralLedgerBook() {
  return (
    <LedgerModuleGate permission="ledger.view">
      {(restaurantId) => (
        <div className="space-y-5">
          <CashPageHeader
            title="Libros contables"
            description="Libro mayor: movimientos de una cuenta con saldo corrido."
          />
          <LedgerNav />
          <LedgerView restaurantId={restaurantId} />
        </div>
      )}
    </LedgerModuleGate>
  );
}
