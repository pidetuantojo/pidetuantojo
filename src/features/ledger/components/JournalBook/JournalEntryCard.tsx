import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCOP } from '@/lib/shared/money';

import { EVENT_LABELS } from '../../helpers/ledger-labels.helpers';
import type { JournalEntry, LedgerAccount } from '../../types/ledger.types';

interface JournalEntryCardProps {
  entry: JournalEntry;
  accountsById: ReadonlyMap<string, Pick<LedgerAccount, 'code' | 'name'>>;
  canReverse: boolean;
  onReverse: (entry: JournalEntry) => void;
}

export function JournalEntryCard({
  entry,
  accountsById,
  canReverse,
  onReverse,
}: JournalEntryCardProps) {
  const isReversal = Boolean(entry.reversesEntryId);
  const isReversed = Boolean(entry.reversedByEntryId);

  return (
    <article
      className="rounded-xl p-4"
      style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border)' }}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold text-[var(--t-text-1)]">{entry.number}</span>
        <span className="text-xs text-[var(--t-text-3)]">{entry.accountingDate}</span>
        <Badge variant="info">{EVENT_LABELS[entry.event] ?? entry.event}</Badge>
        {isReversed && <Badge variant="danger">Reversado</Badge>}
        {isReversal && <Badge variant="warning">Reversión</Badge>}
        {canReverse && !isReversed && !isReversal && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onReverse(entry)}>
            Reversar asiento
          </Button>
        )}
      </header>
      <p className="mt-1 text-sm text-[var(--t-text-2)]">{entry.description}</p>
      <p className="text-xs text-[var(--t-text-3)]">
        Origen: {entry.sourceType} · {entry.sourceId}
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-[var(--t-text-3)]">
              <th className="py-1 pr-3 font-semibold">Cuenta</th>
              <th className="py-1 pr-3 text-right font-semibold">Débito</th>
              <th className="py-1 text-right font-semibold">Crédito</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--t-border)]">
            {entry.lines.map((line, index) => {
              const account = accountsById.get(line.accountId);
              return (
                <tr key={`${line.accountId}-${index}`} className="text-[var(--t-text-1)]">
                  <td className="py-1.5 pr-3">
                    {account ? `${account.code} · ${account.name}` : 'Cuenta eliminada'}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {line.debit > 0 ? formatCOP(line.debit) : ''}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {line.credit > 0 ? formatCOP(line.credit) : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-[var(--t-text-1)]">
              <td className="pr-3 pt-2">Totales</td>
              <td className="pr-3 pt-2 text-right tabular-nums">{formatCOP(entry.totalDebit)}</td>
              <td className="pt-2 text-right tabular-nums">{formatCOP(entry.totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
}
