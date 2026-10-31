'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';

import { nonCashMethods } from '../../helpers/approvals.helpers';
import { closingOutcomeLabel } from '../../helpers/shift.helpers';
import { useCurrentShift } from '../../hooks/useCashQueries';
import { useCashSettings } from '../../hooks/useCashSettings';
import { useShiftActions } from '../../hooks/useShiftActions';
import type { PaymentMethodType } from '@/types';
import type { ShiftStatus } from '../../types/cash.types';
import { CashCard, CashNotice } from '../CashLayout';

import { BlindCloseForm } from './BlindCloseForm';

export function BlindCloseView({ restaurantId }: { restaurantId: string }) {
  const { data: restaurant } = useRestaurant(restaurantId);
  const shiftQuery = useCurrentShift(restaurantId);
  const settings = useCashSettings(restaurantId);
  const { startClose } = useShiftActions(restaurantId);
  // Lo único que se conserva del resultado es el estado: nunca cifras
  const [outcome, setOutcome] = useState<ShiftStatus | null>(null);

  if (outcome) {
    return (
      <CashCard>
        <div className="space-y-3 py-6 text-center">
          <p className="text-xl font-extrabold text-[var(--t-text-1)]">
            {closingOutcomeLabel(outcome)}
          </p>
          <Link
            href={ROUTES.dashboard.caja.root}
            className="inline-block text-sm font-semibold text-[#FF6A1A] hover:underline"
          >
            Volver a caja
          </Link>
        </div>
      </CashCard>
    );
  }

  if (shiftQuery.isLoading || settings.isLoading) {
    return <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>;
  }
  const shift = shiftQuery.data;
  if (!shift) {
    return (
      <CashNotice tone="info" title="No tenés un turno para cerrar">
        <Link href={ROUTES.dashboard.caja.root} className="font-semibold underline">
          Ir a Turno actual
        </Link>
      </CashNotice>
    );
  }
  if (shift.status === 'ABIERTO') {
    return (
      <CashCard title="Primero iniciá el cierre">
        <p className="mb-4 text-sm text-[var(--t-text-3)]">
          Al iniciar el cierre ya no se pueden registrar movimientos en el turno.
        </p>
        <Button onClick={() => startClose.run(shift.id)} isLoading={startClose.isPending}>
          Iniciar cierre
        </Button>
      </CashCard>
    );
  }

  const declarable = Array.from(
    new Set(nonCashMethods(restaurant?.paymentMethods).map((m) => m.type))
  ) as PaymentMethodType[];

  return (
    <BlindCloseForm
      restaurantId={restaurantId}
      shiftId={shift.id}
      denominations={settings.data?.denominations ?? []}
      declarableTypes={declarable}
      onSubmitted={setOutcome}
    />
  );
}
