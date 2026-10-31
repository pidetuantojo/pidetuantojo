'use client';

import { useState } from 'react';

import { CashNotice, CashPageHeader } from '../CashLayout';
import { CashModuleGate } from '../CashModuleGate';
import { ClosingDetailModal } from '../ClosingDetailModal';
import { usePendingApprovals, useRegisters, useShifts } from '../../hooks/useCashQueries';
import type { ShiftRow, ShiftStatus } from '../../types/cash.types';

import { PendingWithdrawalsCard } from './PendingWithdrawalsCard';
import { ShiftsCard } from './ShiftsCard';

function ApprovalsView({ restaurantId }: { restaurantId: string }) {
  const pending = usePendingApprovals(restaurantId);
  const registers = useRegisters(restaurantId);
  const [filter, setFilter] = useState<ShiftStatus | ''>('');
  const recent = useShifts(restaurantId, filter || undefined);
  const [reviewing, setReviewing] = useState<ShiftRow | null>(null);

  const registerName = (id: string) => registers.data?.find((r) => r.id === id)?.name ?? 'Caja';

  if (pending.isLoading) return <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>;
  if (pending.isError) {
    return <CashNotice tone="danger">No se pudieron cargar las aprobaciones.</CashNotice>;
  }

  return (
    <div className="space-y-5">
      <PendingWithdrawalsCard
        restaurantId={restaurantId}
        withdrawals={pending.data?.withdrawals ?? []}
        registerName={registerName}
      />
      <ShiftsCard
        title="Cierres pendientes de aprobación"
        shifts={pending.data?.closes ?? []}
        registerName={registerName}
        emptyText="No hay cierres pendientes."
        onReview={setReviewing}
      />
      <ShiftsCard
        title="Turnos recientes"
        shifts={recent.data ?? []}
        registerName={registerName}
        emptyText={recent.isLoading ? 'Cargando...' : 'No hay turnos para mostrar.'}
        onReview={setReviewing}
        filter={{ value: filter, onChange: setFilter }}
      />
      {reviewing && (
        <ClosingDetailModal
          restaurantId={restaurantId}
          shift={reviewing}
          registerName={registerName(reviewing.registerId)}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}

export function ApprovalsManager() {
  return (
    <div className="space-y-6">
      <CashPageHeader
        title="Aprobaciones"
        description="Retiros parciales y cierres de turno por revisar"
      />
      <CashModuleGate permission="cash.approve">
        {(restaurantId) => <ApprovalsView restaurantId={restaurantId} />}
      </CashModuleGate>
    </div>
  );
}
