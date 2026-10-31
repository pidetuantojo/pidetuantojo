'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth';
import { formatBogotaTime } from '@/lib/shared/bogotaDate';
import { formatCOP } from '@/lib/shared/money';
import { useConfirmStore } from '@/store/confirm.store';

import { cashierLabel, isOwnShift } from '../../helpers/approvals.helpers';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import type { PendingWithdrawal } from '../../types/cash.types';
import { CashCard } from '../CashLayout';
import { ReasonDialog } from '../ReasonDialog';

interface PendingWithdrawalsCardProps {
  restaurantId: string;
  withdrawals: readonly PendingWithdrawal[];
  registerName: (registerId: string) => string;
}

/** Retiros parciales esperando decisión: aprobar o rechazar (el propio cajero no puede aprobar). */
export function PendingWithdrawalsCard({
  restaurantId,
  withdrawals,
  registerName,
}: PendingWithdrawalsCardProps) {
  const { user } = useAuth();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const { decideWithdrawal } = useApprovalActions(restaurantId);
  const [rejecting, setRejecting] = useState<PendingWithdrawal | null>(null);

  async function approve({ shift, movement }: PendingWithdrawal) {
    const ok = await showConfirm({
      title: 'Aprobar retiro',
      message: `¿Aprobar el retiro de ${formatCOP(movement.amount)}?`,
      confirmLabel: 'Aprobar',
    });
    if (!ok) return;
    await decideWithdrawal.run({
      shiftId: shift.id,
      movementId: movement.id,
      input: { decision: 'APROBAR' },
    });
  }

  async function reject(note: string) {
    if (!rejecting) return;
    const result = await decideWithdrawal.run({
      shiftId: rejecting.shift.id,
      movementId: rejecting.movement.id,
      input: { decision: 'RECHAZAR', note },
    });
    if (result.ok) setRejecting(null);
  }

  return (
    <CashCard title="Retiros parciales pendientes">
      {withdrawals.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--t-text-3)]">
          No hay retiros pendientes.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--t-border)]">
          {withdrawals.map((item) => {
            const own = isOwnShift(user?.uid, item.shift);
            return (
              <li key={item.movement.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--t-text-1)]">
                    {formatCOP(item.movement.amount)} · {registerName(item.shift.registerId)}
                  </p>
                  <p className="text-xs text-[var(--t-text-3)]">
                    {cashierLabel(item.shift.cashierUid, user?.uid)} ·{' '}
                    {formatBogotaTime(item.movement.createdAt)}
                    {item.movement.reason ? ` · ${item.movement.reason}` : ''}
                  </p>
                  {own && (
                    <p className="mt-1 text-xs font-semibold text-amber-600">
                      Es tu propio retiro: otro supervisor debe aprobarlo.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!own && (
                    <Button size="sm" onClick={() => approve(item)}>
                      Aprobar
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setRejecting(item)}>
                    Rechazar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rejecting && (
        <ReasonDialog
          title="Rechazar retiro"
          description={formatCOP(rejecting.movement.amount)}
          confirmLabel="Rechazar"
          isPending={decideWithdrawal.isPending}
          onConfirm={reject}
          onClose={() => setRejecting(null)}
        />
      )}
    </CashCard>
  );
}
