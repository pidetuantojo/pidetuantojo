'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { formatCOP } from '@/lib/shared/money';

import { generalRegisters } from '../../helpers/approvals.helpers';
import { methodTypeLabel } from '../../helpers/shift.helpers';
import { useRegisterBalance, useRegisters } from '../../hooks/useCashQueries';
import { useCashSettings } from '../../hooks/useCashSettings';
import { useRegisterMovements } from '../../hooks/useRegisterMovements';
import type { PaymentMethodType } from '@/types';
import { CashCard, CashNotice, CashPageHeader } from '../CashLayout';
import { CashModuleGate } from '../CashModuleGate';
import { MovementsList } from '../MovementsList';

import { DepositDialog } from './DepositDialog';
import { GeneralMovementDialog } from './GeneralMovementDialog';
import { SettlementDialog } from './SettlementDialog';

type DialogKind = 'INGRESO_VARIO' | 'EGRESO' | 'DEPOSIT' | 'SETTLEMENT' | null;

function GeneralBoxView({ restaurantId }: { restaurantId: string }) {
  const { can } = useAuth();
  const { data: restaurant } = useRestaurant(restaurantId);
  const registers = useRegisters(restaurantId);
  const settings = useCashSettings(restaurantId);
  const generals = generalRegisters(registers.data ?? []);
  const [selected, setSelected] = useState('');
  const registerId = selected || settings.data?.defaultGeneralRegisterId || generals[0]?.id || '';
  const balance = useRegisterBalance(restaurantId, registerId);
  const movements = useRegisterMovements(restaurantId, registerId);
  const [dialog, setDialog] = useState<DialogKind>(null);

  if (registers.isLoading) return <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>;
  if (generals.length === 0) {
    return (
      <CashNotice tone="warning" title="No hay una caja general">
        Creala en la configuración de caja para poder registrar ingresos y consignaciones.
      </CashNotice>
    );
  }

  const byMethod = Object.entries(balance.data?.balanceByMethod ?? {}) as [
    PaymentMethodType,
    number,
  ][];

  return (
    <div className="space-y-5">
      <CashCard
        title="Saldo"
        actions={
          generals.length > 1 ? (
            <div className="w-56">
              <Select
                value={registerId}
                onChange={setSelected}
                options={generals.map((r) => ({ value: r.id, label: r.name }))}
                compact
              />
            </div>
          ) : (
            <span className="text-sm font-semibold text-[var(--t-text-2)]">{generals[0].name}</span>
          )
        }
      >
        {balance.isError ? (
          <CashNotice tone="danger">No se pudo cargar el saldo.</CashNotice>
        ) : (
          <>
            <p className="text-xs text-[var(--t-text-3)]">Efectivo en caja general</p>
            <p
              className="text-3xl font-extrabold text-[var(--t-text-1)]"
              data-testid="general-cash"
            >
              {balance.isLoading ? '...' : formatCOP(balance.data?.cash ?? 0)}
            </p>
            {byMethod.filter(([type]) => type !== 'efectivo').length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--t-text-2)]">
                {byMethod
                  .filter(([type]) => type !== 'efectivo')
                  .map(([type, amount]) => (
                    <li key={type}>
                      {methodTypeLabel(type)}:{' '}
                      <span className="font-semibold">{formatCOP(amount)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDialog('INGRESO_VARIO')}>
            Ingreso
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog('EGRESO')}>
            Egreso
          </Button>
          <Button size="sm" onClick={() => setDialog('DEPOSIT')}>
            Consignar al banco
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog('SETTLEMENT')}>
            Liquidación datáfono
          </Button>
        </div>
      </CashCard>

      <CashCard title="Últimos movimientos">
        {movements.error ? (
          <CashNotice tone="danger">
            No se pudieron cargar los movimientos (puede faltar un índice de Firestore).
          </CashNotice>
        ) : (
          <MovementsList movements={movements.movements} />
        )}
      </CashCard>

      {(dialog === 'INGRESO_VARIO' || dialog === 'EGRESO') && (
        <GeneralMovementDialog
          restaurantId={restaurantId}
          registerId={registerId}
          type={dialog}
          canChooseCounterpart={can('ledger.manage')}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'DEPOSIT' && (
        <DepositDialog
          restaurantId={restaurantId}
          registerId={registerId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'SETTLEMENT' && (
        <SettlementDialog
          restaurantId={restaurantId}
          paymentMethods={restaurant?.paymentMethods}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

export function GeneralBoxManager() {
  return (
    <div className="space-y-6">
      <CashPageHeader
        title="Caja general"
        description="Saldo, ingresos, consignaciones y liquidaciones"
      />
      <CashModuleGate permission="cash.approve">
        {(restaurantId) => <GeneralBoxView restaurantId={restaurantId} />}
      </CashModuleGate>
    </div>
  );
}
