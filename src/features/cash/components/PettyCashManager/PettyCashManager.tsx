'use client';

import { useState } from 'react';

import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth';

import { useRegisters } from '../../hooks/useCashQueries';
import { useCashSettings } from '../../hooks/useCashSettings';
import { usePettyStatus } from '../../hooks/usePettyQueries';
import { CashNotice, CashPageHeader } from '../CashLayout';
import { CashModuleGate } from '../CashModuleGate';

import { FundDialog } from './FundDialog';
import { PettyExpensesCard } from './PettyExpensesCard';
import { PettyStatusCard } from './PettyStatusCard';
import { ReimbursementsCard } from './ReimbursementsCard';

function PettyCashView({ restaurantId }: { restaurantId: string }) {
  const { user, can } = useAuth();
  const registers = useRegisters(restaurantId);
  const settings = useCashSettings(restaurantId);
  const pettyRegisters = (registers.data ?? []).filter((r) => r.type === 'MENOR' && r.isActive);
  const [selected, setSelected] = useState('');
  const registerId = selected || pettyRegisters[0]?.id || '';
  const status = usePettyStatus(restaurantId, registerId);
  const [fundOpen, setFundOpen] = useState(false);
  const canApprove = can('petty_cash.approve');

  if (registers.isLoading) return <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>;
  if (pettyRegisters.length === 0) {
    return (
      <CashNotice tone="warning" title="No hay una caja menor">
        Creala en la configuración de caja (tipo Caja menor) para registrar gastos.
      </CashNotice>
    );
  }

  return (
    <div className="space-y-5">
      {pettyRegisters.length > 1 && (
        <div className="w-64">
          <Select
            label="Caja menor"
            value={registerId}
            onChange={setSelected}
            options={pettyRegisters.map((r) => ({ value: r.id, label: r.name }))}
          />
        </div>
      )}
      <PettyStatusCard
        status={status.data}
        isLoading={status.isLoading}
        isError={status.isError}
        canAdjustFund={canApprove}
        onFund={() => setFundOpen(true)}
      />
      <PettyExpensesCard
        restaurantId={restaurantId}
        registerId={registerId}
        maxExpense={status.data?.maxExpense ?? 0}
        cashOnHand={status.data?.cashOnHand ?? 0}
        constituted={status.data?.constituted ?? false}
      />
      <ReimbursementsCard
        restaurantId={restaurantId}
        registerId={registerId}
        uid={user?.uid}
        canApprove={canApprove}
        defaultGeneralId={settings.data?.defaultGeneralRegisterId}
      />
      {fundOpen && status.data && (
        <FundDialog
          restaurantId={restaurantId}
          registerId={registerId}
          status={status.data}
          defaultGeneralId={settings.data?.defaultGeneralRegisterId}
          onClose={() => setFundOpen(false)}
        />
      )}
    </div>
  );
}

/** Caja menor: fondo fijo, vales, legalización y reembolsos. */
export function PettyCashManager() {
  return (
    <div className="space-y-6">
      <CashPageHeader
        title="Caja menor"
        description="Fondo fijo, gastos con soporte y reembolsos"
      />
      <CashModuleGate permission="petty_cash.manage">
        {(restaurantId) => <PettyCashView restaurantId={restaurantId} />}
      </CashModuleGate>
    </div>
  );
}
