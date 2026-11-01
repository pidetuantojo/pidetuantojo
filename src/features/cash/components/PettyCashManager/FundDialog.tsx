'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCOP, type Money } from '@/lib/shared/money';

import { validateFund } from '../../helpers/petty-forms.helpers';
import { useFundSourceDraft } from '../../hooks/useFundSourceDraft';
import { usePettyReimbursementActions } from '../../hooks/usePettyActions';
import { useLedgerAccounts, useRegisters } from '../../hooks/useCashQueries';
import type { PettyStatus } from '../../types/cash.petty.types';
import { MoneyInput } from '../MoneyInput';

import { FundSourceFields } from './FundSourceFields';

interface FundDialogProps {
  restaurantId: string;
  registerId: string;
  status: PettyStatus;
  defaultGeneralId?: string;
  onClose: () => void;
}

/** Constituir (primera vez) o ajustar el fondo fijo de la caja menor. */
export function FundDialog({
  restaurantId,
  registerId,
  status,
  defaultGeneralId,
  onClose,
}: FundDialogProps) {
  const { setFund } = usePettyReimbursementActions(restaurantId);
  const registers = useRegisters(restaurantId);
  const accounts = useLedgerAccounts(restaurantId);
  const source = useFundSourceDraft(defaultGeneralId);
  const [target, setTarget] = useState<Money | null>(status.fundAmount || null);
  const [touched, setTouched] = useState(false);
  const { errors, valid } = validateFund({
    target,
    sourceKind: source.kind,
    generalId: source.generalId,
    bankAccountId: source.bankAccountId,
    maxExpense: status.maxExpense,
  });
  const current = status.cashOnHand + status.pendingVouchersTotal;

  async function submit() {
    setTouched(true);
    if (!valid || target === null || !source.source || setFund.isPending) return;
    const result = await setFund.run({
      registerId,
      input: { targetAmount: target, source: source.source },
    });
    if (result.ok) onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={status.constituted ? 'Ajustar el fondo' : 'Constituir el fondo'}
      description={
        status.constituted
          ? `Fondo actual: ${formatCOP(current)}. La diferencia entra o sale de la caja elegida.`
          : 'Primer traslado de dinero a la caja menor.'
      }
      size="sm"
    >
      <div className="space-y-4 p-6">
        <MoneyInput
          id="petty-fund-target"
          label="Fondo fijo (total)"
          value={target}
          onChange={setTarget}
          error={touched ? errors.target : undefined}
        />
        <FundSourceFields
          draft={source}
          registers={registers.data ?? []}
          accounts={accounts.data ?? []}
          accountsDenied={accounts.isError}
          error={touched ? errors.source : undefined}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={setFund.isPending}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
