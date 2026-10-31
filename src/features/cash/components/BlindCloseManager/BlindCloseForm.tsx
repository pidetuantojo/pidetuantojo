'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import type { Money } from '@/lib/shared/money';
import { useConfirmStore } from '@/store/confirm.store';
import { useToastStore } from '@/store/toast.store';
import type { PaymentMethodType } from '@/types';

import { cashErrorMessage } from '../../helpers/cash-errors.helpers';
import { REASON_MAX } from '../../helpers/reason.helpers';
import {
  isJustificationRequired,
  JUSTIFICATION_REQUIRED_MESSAGE,
  methodTypeLabel,
} from '../../helpers/shift.helpers';
import { useShiftActions } from '../../hooks/useShiftActions';
import type { CountMap, Denomination, MoneyByMethod, ShiftStatus } from '../../types/cash.types';
import { CashCard, CashNotice } from '../CashLayout';
import { DenominationCounter } from '../DenominationCounter';
import { MoneyInput } from '../MoneyInput';

const JUSTIFICATION_ID = 'close-justification';
const MIN_JUSTIFICATION = 5;

interface BlindCloseFormProps {
  restaurantId: string;
  shiftId: string;
  denominations: readonly Denomination[];
  /** Medios no efectivo que el restaurante usa (datáfono, Nequi...). */
  declarableTypes: readonly PaymentMethodType[];
  onSubmitted: (status: ShiftStatus) => void;
}

/**
 * Conteo a ciegas. El único total visible es el del propio conteo del cajero; el esperado y las
 * diferencias no existen en esta pantalla ni en lo que responde el servidor.
 */
export function BlindCloseForm({
  restaurantId,
  shiftId,
  denominations,
  declarableTypes,
  onSubmitted,
}: BlindCloseFormProps) {
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const showToast = useToastStore((s) => s.showToast);
  const { submitCount } = useShiftActions(restaurantId);
  const [count, setCount] = useState<CountMap>({});
  const [declared, setDeclared] = useState<Partial<Record<PaymentMethodType, Money | null>>>({});
  const [justification, setJustification] = useState('');
  const [needsJustification, setNeedsJustification] = useState(false);

  const trimmed = justification.trim();
  const justificationError =
    trimmed.length > 0 && trimmed.length < MIN_JUSTIFICATION
      ? `La observación debe tener al menos ${MIN_JUSTIFICATION} caracteres`
      : undefined;

  async function submit() {
    if (submitCount.isPending || (trimmed.length > 0 && trimmed.length < MIN_JUSTIFICATION)) return;
    const ok = await showConfirm({
      title: 'Enviar conteo',
      message: 'Una vez enviado no podrás modificar el conteo. ¿Querés cerrar el turno?',
      confirmLabel: 'Enviar conteo',
    });
    if (!ok) return;

    const declaredByMethod: MoneyByMethod = {};
    for (const type of declarableTypes) {
      const value = declared[type];
      if (value !== null && value !== undefined) declaredByMethod[type] = value;
    }
    const result = await submitCount.run({
      shiftId,
      input: {
        cashCount: count,
        ...(Object.keys(declaredByMethod).length > 0 ? { declaredByMethod } : {}),
        ...(trimmed ? { justification: trimmed } : {}),
      },
    });

    if (result.ok) {
      onSubmitted(result.data.status);
      return;
    }
    if (isJustificationRequired(result.error)) {
      // Mensaje neutro: sin cifras de lo esperado ni de la diferencia
      setNeedsJustification(true);
      document.getElementById(JUSTIFICATION_ID)?.focus();
      return;
    }
    showToast(cashErrorMessage(result.error), 'error');
  }

  return (
    <div className="space-y-5">
      <CashCard
        title="Conteo de efectivo"
        description="Contá todo el efectivo de la caja, billete por billete."
      >
        <DenominationCounter denominations={denominations} value={count} onChange={setCount} />
      </CashCard>

      {declarableTypes.length > 0 && (
        <CashCard
          title="Otros medios de pago"
          description="Opcional: lo que muestra el cierre de lote del datáfono o tu reporte de cada medio."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {declarableTypes.map((type) => (
              <MoneyInput
                key={type}
                id={`declared-${type}`}
                label={methodTypeLabel(type)}
                value={declared[type] ?? null}
                onChange={(value) => setDeclared((prev) => ({ ...prev, [type]: value }))}
              />
            ))}
          </div>
        </CashCard>
      )}

      <CashCard title="Observaciones">
        {needsJustification && (
          <div className="mb-3">
            <CashNotice tone="warning">{JUSTIFICATION_REQUIRED_MESSAGE}</CashNotice>
          </div>
        )}
        <Textarea
          id={JUSTIFICATION_ID}
          label="Observaciones (opcional)"
          maxLength={REASON_MAX}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          error={justificationError}
          placeholder="Ej: se entregó un cambio de más"
        />
      </CashCard>

      <div className="flex justify-end">
        <Button onClick={submit} isLoading={submitCount.isPending}>
          Enviar conteo
        </Button>
      </div>
    </div>
  );
}
