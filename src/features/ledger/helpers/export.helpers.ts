// Exportación de los libros contables: filas planas (encabezados en español, montos enteros).
import type { JournalEntry, LedgerAccount } from '@/lib/ledger/ledger.types';
import type { LedgerReport, TrialBalanceReport } from '@/lib/ledger/reports.types';
import { downloadCsv, downloadXlsx, type ExportRow } from '@/lib/shared/tabularExport';

export { downloadCsv, downloadXlsx };
export type { ExportRow };

type AccountsById = ReadonlyMap<string, Pick<LedgerAccount, 'code' | 'name'>>;

function entryStatus(entry: JournalEntry): string {
  if (entry.reversesEntryId) return 'Reversión';
  return entry.reversedByEntryId ? 'Reversado' : 'Vigente';
}

/** Libro diario: una fila por línea de cada asiento. */
export function journalRows(entries: readonly JournalEntry[], accounts: AccountsById): ExportRow[] {
  return entries.flatMap((entry) =>
    entry.lines.map((line) => ({
      Fecha: entry.accountingDate,
      Asiento: entry.number,
      Evento: entry.event,
      Descripción: entry.description,
      Origen: `${entry.sourceType}:${entry.sourceId}`,
      Estado: entryStatus(entry),
      'Código de cuenta': accounts.get(line.accountId)?.code ?? '',
      Cuenta: accounts.get(line.accountId)?.name ?? '',
      Débito: line.debit,
      Crédito: line.credit,
    }))
  );
}

/** Libro mayor: saldo inicial, movimientos con saldo corrido y totales. */
export function ledgerRows(report: LedgerReport): ExportRow[] {
  const blank = { Asiento: '', Evento: '', Origen: '', Débito: null, Crédito: null };
  return [
    { Fecha: report.from, ...blank, Concepto: 'Saldo inicial', Saldo: report.openingBalance },
    ...report.lines.map((l) => ({
      Fecha: l.accountingDate,
      Asiento: l.entryNumber,
      Evento: l.event,
      Origen: `${l.sourceType}:${l.sourceId}`,
      Concepto: '',
      Débito: l.debit,
      Crédito: l.credit,
      Saldo: l.balance,
    })),
    {
      Fecha: report.to,
      ...blank,
      Concepto: 'Totales y saldo final',
      Débito: report.totalDebit,
      Crédito: report.totalCredit,
      Saldo: report.closingBalance,
    },
  ];
}

/** Balance de comprobación: una fila por cuenta y una de totales. */
export function trialBalanceRows(report: TrialBalanceReport): ExportRow[] {
  return [
    ...report.rows.map((r) => ({
      Código: r.code,
      Cuenta: r.name,
      Naturaleza: r.nature === 'DEBITO' ? 'Débito' : 'Crédito',
      'Saldo inicial': r.opening,
      Débitos: r.debit,
      Créditos: r.credit,
      'Saldo final': r.closing,
    })),
    {
      Código: '',
      Cuenta: 'TOTALES',
      Naturaleza: '',
      'Saldo inicial': null,
      Débitos: report.totalDebit,
      Créditos: report.totalCredit,
      'Saldo final': null,
    },
  ];
}

export function exportFilename(kind: string, from: string, to: string, ext: 'csv' | 'xlsx') {
  return `${kind}-${from}_${to}.${ext}`;
}
