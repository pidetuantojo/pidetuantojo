'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { formatBogotaDateTime } from '@/lib/shared/bogotaDate';
import { useConfirmStore } from '@/store/confirm.store';

import { useShiftMovements } from '../../hooks/useCashQueries';
import { useShiftActions } from '../../hooks/useShiftActions';
import type { ManualMovementType, MovementRow } from '../../types/cash.types';
import { CashCard, CashNotice } from '../CashLayout';
import { ManualMovementDialog } from '../ManualMovementDialog';
import { MovementsList } from '../MovementsList';
import { ReasonDialog } from '../ReasonDialog';

import type { ShiftPanelProps } from './ShiftPanel.types';

const ACTIONS: { type: ManualMovementType; label: string }[] = [
  { type: 'INGRESO_VARIO', label: 'Ingreso' },
  { type: 'EGRESO', label: 'Egreso' },
  { type: 'RETIRO_PARCIAL', label: 'Retiro parcial' },
];

/** Turno abierto: movimientos propios (sin totales ni esperado) y acciones del cajero. */
export function ShiftPanel({
  restaurantId,
  shift,
  register,
  paymentMethods,
  canReverse,
  onCloseStarted,
}: ShiftPanelProps) {
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const { reverse, startClose } = useShiftActions(restaurantId);
  const { data, isLoading } = useShiftMovements(restaurantId, shift.id);
  const [dialog, setDialog] = useState<ManualMovementType | null>(null);
  const [toReverse, setToReverse] = useState<MovementRow | null>(null);

  async function handleStartClose() {
    const ok = await showConfirm({
      title: 'Iniciar cierre',
      message:
        'Ya no podrás registrar más movimientos en este turno. Después contás el efectivo para cerrarlo.',
      confirmLabel: 'Iniciar cierre',
    });
    if (!ok) return;
    const result = await startClose.run(shift.id);
    if (result.ok) onCloseStarted();
  }

  async function handleReverse(reason: string) {
    if (!toReverse) return;
    const result = await reverse.run({ movementId: toReverse.id, reason });
    if (result.ok) setToReverse(null);
  }

  return (
    <div className="space-y-5">
      <CashCard
        title={register?.name ?? 'Turno actual'}
        description={`Abierto el ${formatBogotaDateTime(shift.openedAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map(({ type, label }) => (
              <Button key={type} size="sm" variant="secondary" onClick={() => setDialog(type)}>
                {label}
              </Button>
            ))}
            <Button size="sm" onClick={handleStartClose} isLoading={startClose.isPending}>
              Iniciar cierre
            </Button>
          </div>
        }
      >
        <CashNotice tone="info">
          Al cerrar vas a contar el efectivo sin ver cuánto debería haber: es un cierre a ciegas.
        </CashNotice>
      </CashCard>

      <CashCard title="Movimientos del turno">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-[var(--t-text-3)]">Cargando...</p>
        ) : (
          <MovementsList
            movements={data?.movements ?? []}
            onReverse={canReverse ? setToReverse : undefined}
          />
        )}
      </CashCard>

      {dialog && (
        <ManualMovementDialog
          type={dialog}
          restaurantId={restaurantId}
          shiftId={shift.id}
          paymentMethods={paymentMethods}
          onClose={() => setDialog(null)}
        />
      )}
      {toReverse && (
        <ReasonDialog
          title="Reversar movimiento"
          description={`Comprobante ${toReverse.receiptNumber}`}
          confirmLabel="Reversar"
          isPending={reverse.isPending}
          onConfirm={handleReverse}
          onClose={() => setToReverse(null)}
        />
      )}
    </div>
  );
}
