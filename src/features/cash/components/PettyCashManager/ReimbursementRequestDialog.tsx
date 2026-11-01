'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCOP } from '@/lib/shared/money';

import { sumSelected } from '../../helpers/petty-forms.helpers';
import { usePettyReimbursementActions } from '../../hooks/usePettyActions';
import type { PettyExpense } from '../../types/cash.petty.types';

interface ReimbursementRequestDialogProps {
  restaurantId: string;
  registerId: string;
  /** Solo gastos legalizados y libres. */
  expenses: readonly PettyExpense[];
  onClose: () => void;
}

/** Elegir los gastos legalizados que se reembolsan; muestra el total. */
export function ReimbursementRequestDialog({
  restaurantId,
  registerId,
  expenses,
  onClose,
}: ReimbursementRequestDialogProps) {
  const { request } = usePettyReimbursementActions(restaurantId);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(expenses.map((e) => e.id))
  );
  const total = sumSelected(expenses, selected);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0 || request.isPending) return;
    const result = await request.run({ registerId, expenseIds: Array.from(selected) });
    if (result.ok) onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Solicitar reembolso"
      description="Quien aprueba repone el fondo con el total de los gastos elegidos."
      size="md"
    >
      <div className="space-y-4 p-6">
        <ul className="max-h-72 divide-y divide-[var(--t-border)] overflow-y-auto">
          {expenses.map((e) => (
            <li key={e.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                  aria-label={`Incluir vale ${e.voucherNumber}`}
                />
                <span className="font-mono text-xs">{e.voucherNumber}</span>
                <span className="flex-1 truncate">{e.concept}</span>
                <span className="tabular-nums">{formatCOP(e.amount)}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-right text-sm font-semibold text-[var(--t-text-1)]">
          Total: <span data-testid="reimbursement-total">{formatCOP(total)}</span> ({selected.size}{' '}
          {selected.size === 1 ? 'gasto' : 'gastos'})
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={request.isPending} disabled={selected.size === 0}>
            Solicitar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
