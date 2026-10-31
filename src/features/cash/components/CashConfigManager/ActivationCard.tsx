'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth';
import { useConfirmStore } from '@/store/confirm.store';
import { useToastStore } from '@/store/toast.store';

import { activationHint } from '../../helpers/activation-hints.helpers';
import { cashErrorMessage } from '../../helpers/cash-errors.helpers';
import { useCashActivation } from '../../hooks/useCashActivation';
import { useCashConfigActions } from '../../hooks/useCashConfigActions';
import { CashApiError } from '../../services/cash.api';
import { CashCard } from '../CashLayout';

/** Checklist de activación del módulo y el interruptor (activar / desactivar). */
export function ActivationCard({ restaurantId }: { restaurantId: string }) {
  const { can } = useAuth();
  const showConfirm = useConfirmStore((s) => s.showConfirm);
  const showToast = useToastStore((s) => s.showToast);
  const activation = useCashActivation(restaurantId);
  const { setupLedger } = useCashConfigActions(restaurantId);
  const [blocked, setBlocked] = useState<string[]>([]);

  const enabled = activation.data?.enabled === true;
  const missing = blocked.length > 0 ? blocked : (activation.data?.missing ?? []);

  async function toggle() {
    const next = !enabled;
    const ok = await showConfirm({
      title: next ? 'Activar el módulo de caja' : 'Desactivar el módulo de caja',
      message: next
        ? 'Al activarlo, los cobros de pedidos pasan por el flujo de caja: se exigen turnos para el efectivo y cada pago genera su comprobante y asiento contable.'
        : 'Al desactivarlo, los cobros vuelven a registrarse como antes, sin turnos ni comprobantes de caja. Los movimientos ya registrados se conservan.',
      confirmLabel: next ? 'Activar' : 'Desactivar',
    });
    if (!ok) return;
    try {
      await activation.setEnabled(next);
      setBlocked([]);
      showToast(next ? 'Módulo de caja activado' : 'Módulo de caja desactivado');
    } catch (error) {
      if (error instanceof CashApiError && error.missing.length > 0) setBlocked(error.missing);
      showToast(cashErrorMessage(error), 'error');
    }
  }

  return (
    <CashCard
      title="Activación del módulo"
      description={enabled ? 'El módulo de caja está activo.' : 'El módulo de caja está apagado.'}
      actions={
        <Button
          size="sm"
          variant={enabled ? 'danger' : 'primary'}
          onClick={toggle}
          isLoading={activation.isSaving}
          disabled={activation.isLoading || (!enabled && missing.length > 0)}
        >
          {enabled ? 'Desactivar módulo' : 'Activar módulo'}
        </Button>
      }
    >
      {activation.isLoading ? (
        <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>
      ) : missing.length === 0 ? (
        <p className="text-sm text-emerald-600">Todos los requisitos están completos.</p>
      ) : (
        <>
          <p className="mb-2 text-sm font-semibold text-[var(--t-text-2)]">Falta completar:</p>
          <ul className="space-y-2">
            {missing.map((item) => {
              const { hint, action } = activationHint(item);
              return (
                <li
                  key={item}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40"
                >
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{item}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">{hint}</p>
                  {action === 'ledger' && can('ledger.manage') && (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => setupLedger.run()}
                      isLoading={setupLedger.isPending}
                    >
                      Inicializar plan de cuentas
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </CashCard>
  );
}
