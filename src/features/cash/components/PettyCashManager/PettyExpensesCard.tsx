'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { formatCOP } from '@/lib/shared/money';

import {
  EXPENSE_STATUS_LABELS,
  isExpenseOpen,
  selectableForReimbursement,
} from '../../helpers/petty-forms.helpers';
import { usePettyExpenseActions } from '../../hooks/usePettyActions';
import { usePettyExpenses } from '../../hooks/usePettyQueries';
import type { PettyExpense, PettyExpenseStatus } from '../../types/cash.petty.types';
import { CashCard, CashNotice } from '../CashLayout';
import { ReasonDialog } from '../ReasonDialog';

import { AttachDialog } from './AttachDialog';
import { ExpenseFormDialog } from './ExpenseFormDialog';
import { ReimbursementRequestDialog } from './ReimbursementRequestDialog';

const STATUS_VARIANT = {
  PENDIENTE: 'warning',
  LEGALIZADO: 'info',
  REEMBOLSADO: 'success',
  ANULADO: 'default',
} as const;

const FILTER_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  ...(Object.keys(EXPENSE_STATUS_LABELS) as PettyExpenseStatus[]).map((value) => ({
    value,
    label: EXPENSE_STATUS_LABELS[value],
  })),
];

interface PettyExpensesCardProps {
  restaurantId: string;
  registerId: string;
  maxExpense: number;
  cashOnHand: number;
  constituted: boolean;
}

type Dialog =
  | { kind: 'new' }
  | { kind: 'reimburse' }
  | { kind: 'attach'; id: string }
  | { kind: 'annul'; id: string };

/** Vales de la caja menor: tabla con filtro y acciones (adjuntar, legalizar, anular). */
export function PettyExpensesCard({
  restaurantId,
  registerId,
  maxExpense,
  cashOnHand,
  constituted,
}: PettyExpensesCardProps) {
  const [filter, setFilter] = useState<PettyExpenseStatus | ''>('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const expenses = usePettyExpenses(restaurantId, registerId, filter || undefined);
  const { legalize, annul } = usePettyExpenseActions(restaurantId);
  const rows = expenses.data ?? [];
  const findRow = (id: string): PettyExpense | undefined => rows.find((e) => e.id === id);
  const reimbursable = selectableForReimbursement(rows);

  return (
    <CashCard
      title="Gastos (vales)"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select
              value={filter}
              onChange={(v) => setFilter(v as PettyExpenseStatus | '')}
              options={FILTER_OPTIONS}
              compact
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={reimbursable.length === 0}
            onClick={() => setDialog({ kind: 'reimburse' })}
          >
            Solicitar reembolso
          </Button>
          <Button size="sm" disabled={!constituted} onClick={() => setDialog({ kind: 'new' })}>
            Registrar gasto
          </Button>
        </div>
      }
    >
      {expenses.isError ? (
        <CashNotice tone="danger">
          No se pudieron cargar los gastos (puede faltar un índice de Firestore).
        </CashNotice>
      ) : expenses.isLoading ? (
        <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--t-text-3)]">No hay gastos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[var(--t-text-3)]">
                <th className="py-2 pr-3 font-semibold">Vale</th>
                <th className="py-2 pr-3 font-semibold">Concepto</th>
                <th className="py-2 pr-3 font-semibold">Tercero</th>
                <th className="py-2 pr-3 font-semibold">Categoría</th>
                <th className="py-2 pr-3 text-right font-semibold">Monto</th>
                <th className="py-2 pr-3 font-semibold">Fecha</th>
                <th className="py-2 pr-3 font-semibold">Estado</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--t-border)]">
              {rows.map((e) => (
                <tr key={e.id} className="text-[var(--t-text-1)]">
                  <td className="py-2 pr-3 font-mono text-xs">{e.voucherNumber}</td>
                  <td className="py-2 pr-3">{e.concept}</td>
                  <td className="py-2 pr-3">{e.thirdPartyName}</td>
                  <td className="py-2 pr-3">{e.categoryName}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatCOP(e.amount)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs">
                    {e.date.split('-').reverse().join('/')}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant={STATUS_VARIANT[e.status]}>
                      {EXPENSE_STATUS_LABELS[e.status]}
                      {e.reimbursementId && e.status === 'LEGALIZADO' ? ' · en reembolso' : ''}
                    </Badge>
                  </td>
                  <td className="space-x-3 whitespace-nowrap py-2 text-right">
                    {isExpenseOpen(e) && (
                      <>
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#FF6A1A] hover:underline"
                          onClick={() => setDialog({ kind: 'attach', id: e.id })}
                        >
                          Adjuntar ({e.attachments.length})
                        </button>
                        {e.status === 'PENDIENTE' && (
                          <button
                            type="button"
                            className="text-xs font-semibold text-[#FF6A1A] hover:underline disabled:opacity-50"
                            disabled={e.attachments.length === 0 || legalize.isPending}
                            title={e.attachments.length === 0 ? 'Adjuntá el soporte primero' : ''}
                            onClick={() => legalize.run(e.id)}
                          >
                            Legalizar
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-600 hover:underline"
                          onClick={() => setDialog({ kind: 'annul', id: e.id })}
                        >
                          Anular
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === 'new' && (
        <ExpenseFormDialog
          restaurantId={restaurantId}
          registerId={registerId}
          maxExpense={maxExpense}
          cashOnHand={cashOnHand}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'reimburse' && (
        <ReimbursementRequestDialog
          restaurantId={restaurantId}
          registerId={registerId}
          expenses={reimbursable}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'attach' && findRow(dialog.id) && (
        <AttachDialog
          restaurantId={restaurantId}
          expense={findRow(dialog.id) as PettyExpense}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'annul' && (
        <ReasonDialog
          title="Anular gasto"
          description="El efectivo vuelve a la caja menor."
          confirmLabel="Anular"
          isPending={annul.isPending}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const result = await annul.run({ expenseId: dialog.id, reason });
            if (result.ok) setDialog(null);
          }}
        />
      )}
    </CashCard>
  );
}
