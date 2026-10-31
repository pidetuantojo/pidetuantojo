'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';

import { useCurrentShift, useRegisters } from '../../hooks/useCashQueries';
import { useCashSettings } from '../../hooks/useCashSettings';
import { useOwnPendingClose } from '../../hooks/useOwnPendingClose';
import { CashNotice, CashPageHeader } from '../CashLayout';
import { CashModuleGate } from '../CashModuleGate';
import { OpenShiftForm } from '../OpenShiftForm';
import { ShiftPanel } from '../ShiftPanel';

function CurrentShiftView({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const { user, can } = useAuth();
  const { data: restaurant } = useRestaurant(restaurantId);
  const shiftQuery = useCurrentShift(restaurantId);
  const registers = useRegisters(restaurantId);
  const settings = useCashSettings(restaurantId);
  const shift = shiftQuery.data;
  const pending = useOwnPendingClose(restaurantId, user?.uid, shiftQuery.isSuccess && !shift);

  // Un turno en cierre solo tiene sentido en la pantalla de conteo
  useEffect(() => {
    if (shift?.status === 'EN_CIERRE') router.replace(ROUTES.dashboard.caja.cierre);
  }, [shift?.status, router]);

  if (shiftQuery.isLoading || registers.isLoading || settings.isLoading) {
    return <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>;
  }
  if (shiftQuery.isError) {
    return <CashNotice tone="danger">No se pudo cargar tu turno. Intentá de nuevo.</CashNotice>;
  }

  if (!shift) {
    return pending.data ? (
      <CashNotice tone="info" title="Tu cierre está pendiente de aprobación">
        Un supervisor debe revisarlo. Cuando lo apruebe podrás abrir un nuevo turno.
      </CashNotice>
    ) : (
      <OpenShiftForm
        restaurantId={restaurantId}
        registers={registers.data ?? []}
        denominations={settings.data?.denominations ?? []}
      />
    );
  }

  if (shift.status === 'EN_CIERRE') {
    return (
      <CashNotice tone="info" title="Tu turno está en cierre">
        <Link href={ROUTES.dashboard.caja.cierre} className="font-semibold underline">
          Continuar con el conteo
        </Link>
      </CashNotice>
    );
  }

  return (
    <ShiftPanel
      restaurantId={restaurantId}
      shift={shift}
      register={registers.data?.find((r) => r.id === shift.registerId)}
      paymentMethods={restaurant?.paymentMethods}
      canReverse={can('cash.reverse')}
      onCloseStarted={() => router.push(ROUTES.dashboard.caja.cierre)}
    />
  );
}

export function CurrentShiftManager() {
  return (
    <div className="space-y-6">
      <CashPageHeader title="Turno actual" description="Abrí, operá y cerrá tu turno de caja" />
      <CashModuleGate permission="cash.operate">
        {(restaurantId) => <CurrentShiftView restaurantId={restaurantId} />}
      </CashModuleGate>
    </div>
  );
}
