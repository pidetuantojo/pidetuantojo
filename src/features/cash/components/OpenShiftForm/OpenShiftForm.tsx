'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { formatCOP } from '@/lib/shared/money';

import { openableRegisters } from '../../helpers/approvals.helpers';
import { countTotal } from '../../helpers/count.helpers';
import { useShiftActions } from '../../hooks/useShiftActions';
import type { CountMap } from '../../types/cash.types';
import { CashCard, CashNotice } from '../CashLayout';
import { DenominationCounter } from '../DenominationCounter';

import type { OpenShiftFormProps } from './OpenShiftForm.types';

/** Abrir turno: caja registradora + conteo de la base recibida (billete por billete). */
export function OpenShiftForm({ restaurantId, registers, denominations }: OpenShiftFormProps) {
  const { open } = useShiftActions(restaurantId);
  const available = openableRegisters(registers);
  const [registerId, setRegisterId] = useState(available[0]?.id ?? '');
  const [count, setCount] = useState<CountMap>({});
  const total = countTotal(count, denominations);

  if (available.length === 0) {
    return (
      <CashNotice tone="warning" title="No hay cajas registradoras activas">
        Pedile a un administrador que cree una caja registradora en la configuración de caja.
      </CashNotice>
    );
  }

  async function submit() {
    if (!registerId || open.isPending) return;
    await open.run({ registerId, openingCount: count });
  }

  return (
    <CashCard
      title="Abrir turno"
      description="Contá la base que recibís antes de empezar a cobrar."
    >
      <div className="space-y-5">
        <Select
          label="Caja"
          value={registerId}
          onChange={setRegisterId}
          options={available.map((r) => ({ value: r.id, label: r.name }))}
        />
        <DenominationCounter
          denominations={denominations}
          value={count}
          onChange={setCount}
          hideTotal
        />
        <div className="flex items-center justify-between border-t border-[var(--t-border)] pt-3">
          <div>
            <p className="text-xs text-[var(--t-text-3)]">Base declarada</p>
            <p
              className="text-xl font-extrabold text-[var(--t-text-1)]"
              data-testid="opening-total"
            >
              {formatCOP(total)}
            </p>
          </div>
          <Button onClick={submit} isLoading={open.isPending} disabled={!registerId}>
            Abrir turno
          </Button>
        </div>
      </div>
    </CashCard>
  );
}
