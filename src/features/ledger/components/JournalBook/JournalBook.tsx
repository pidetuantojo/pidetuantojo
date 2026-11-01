'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth';
import { CashNotice, CashPageHeader } from '@/features/cash/components/CashLayout';
import { ReasonDialog } from '@/features/cash/components/ReasonDialog';

import {
  downloadCsv,
  downloadXlsx,
  exportFilename,
  journalRows,
} from '../../helpers/export.helpers';
import { currentMonthRange } from '../../helpers/range.helpers';
import { useReverseEntry } from '../../hooks/useLedgerActions';
import { useJournal, useLedgerAccounts } from '../../hooks/useLedgerQueries';
import type { JournalEntry } from '../../types/ledger.types';
import { LedgerModuleGate } from '../LedgerModuleGate';
import { LedgerNav } from '../LedgerNav';
import { ReportToolbar } from '../ReportToolbar';

import { JournalEntryCard } from './JournalEntryCard';

function JournalView({ restaurantId }: { restaurantId: string }) {
  const { can } = useAuth();
  const [range, setRange] = useState(currentMonthRange);
  const journal = useJournal(restaurantId, range.from, range.to);
  const accounts = useLedgerAccounts(restaurantId);
  const reverse = useReverseEntry();
  const [reversing, setReversing] = useState<JournalEntry | null>(null);

  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data]
  );
  const entries = useMemo(
    () => journal.data?.pages.flatMap((page) => page.entries) ?? [],
    [journal.data]
  );

  function exportAs(kind: 'xlsx' | 'csv') {
    const rows = journalRows(entries, accountsById);
    const name = exportFilename('libro-diario', range.from, range.to, kind);
    if (kind === 'xlsx') downloadXlsx(rows, name, 'Libro diario');
    else downloadCsv(rows, name);
  }

  async function confirmReverse(reason: string) {
    if (!reversing) return;
    const result = await reverse.run({ entryId: reversing.id, reason });
    if (result.ok) setReversing(null);
  }

  return (
    <div className="space-y-4">
      <ReportToolbar
        range={range}
        onRangeChange={setRange}
        canExport={can('ledger.export')}
        exportDisabled={entries.length === 0}
        onExcel={() => exportAs('xlsx')}
        onCsv={() => exportAs('csv')}
      />
      {journal.isLoading && <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>}
      {journal.isError && <CashNotice tone="danger">No se pudo cargar el libro diario.</CashNotice>}
      {journal.isSuccess && entries.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--t-text-3)]">
          No hay asientos en este rango.
        </p>
      )}
      <div className="space-y-3">
        {entries.map((entry) => (
          <JournalEntryCard
            key={entry.id}
            entry={entry}
            accountsById={accountsById}
            canReverse={can('ledger.manage')}
            onReverse={setReversing}
          />
        ))}
      </div>
      {journal.hasNextPage && (
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="secondary"
            onClick={() => journal.fetchNextPage()}
            isLoading={journal.isFetchingNextPage}
          >
            Cargar más asientos
          </Button>
          <p className="text-xs text-[var(--t-text-3)]">
            La exportación incluye solo los asientos cargados.
          </p>
        </div>
      )}
      {reversing && (
        <ReasonDialog
          title={`Reversar ${reversing.number}`}
          description="Se crea un contra-asiento con las cuentas invertidas. El original no se modifica."
          confirmLabel="Reversar asiento"
          isPending={reverse.isPending}
          onConfirm={confirmReverse}
          onClose={() => setReversing(null)}
        />
      )}
    </div>
  );
}

/** Libro diario: asientos del rango con sus líneas; el contador puede reversarlos. */
export function JournalBook() {
  return (
    <LedgerModuleGate permission="ledger.view">
      {(restaurantId) => (
        <div className="space-y-5">
          <CashPageHeader
            title="Libros contables"
            description="Libro diario: todos los asientos por fecha contable y número."
          />
          <LedgerNav />
          <JournalView restaurantId={restaurantId} />
        </div>
      )}
    </LedgerModuleGate>
  );
}
