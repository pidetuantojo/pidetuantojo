'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCOP } from '@/lib/shared/money';

import type { PettyStatus } from '../../types/cash.petty.types';
import { CashCard, CashNotice } from '../CashLayout';

interface PettyStatusCardProps {
  status: PettyStatus | undefined;
  isLoading: boolean;
  isError: boolean;
  canAdjustFund: boolean;
  onFund: () => void;
}

function Figure({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--t-text-3)]">{label}</p>
      <p
        className="text-xl font-extrabold tabular-nums text-[var(--t-text-1)]"
        data-testid={testId}
      >
        {formatCOP(value)}
      </p>
    </div>
  );
}

/** Fondo fijo: efectivo + vales pendientes debe ser igual al fondo (el badge lo confirma). */
export function PettyStatusCard({
  status,
  isLoading,
  isError,
  canAdjustFund,
  onFund,
}: PettyStatusCardProps) {
  return (
    <CashCard
      title="Fondo fijo"
      actions={
        status && canAdjustFund ? (
          <Button size="sm" variant="secondary" onClick={onFund}>
            {status.constituted ? 'Ajustar fondo' : 'Constituir fondo'}
          </Button>
        ) : undefined
      }
    >
      {isError ? (
        <CashNotice tone="danger">No se pudo cargar el estado de la caja menor.</CashNotice>
      ) : isLoading || !status ? (
        <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Figure label="Fondo" value={status.fundAmount} testId="petty-fund" />
            <Figure label="Efectivo en caja" value={status.cashOnHand} testId="petty-cash" />
            <Figure
              label="Vales pendientes"
              value={status.pendingVouchersTotal}
              testId="petty-pending"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant={status.invariantOk ? 'success' : 'danger'}>
              {status.invariantOk ? 'Fondo cuadrado' : 'Fondo descuadrado'}
            </Badge>
            <span className="text-[var(--t-text-3)]">
              Efectivo + vales pendientes {status.invariantOk ? '=' : '≠'} fondo
            </span>
          </div>
          {!status.constituted && (
            <CashNotice tone="warning" title="El fondo todavía no está constituido">
              Hasta que se constituya no se pueden registrar gastos.
            </CashNotice>
          )}
        </div>
      )}
    </CashCard>
  );
}
