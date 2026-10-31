'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCOP } from '@/lib/shared/money';

import { useCashConfigActions } from '../../hooks/useCashConfigActions';
import { useLedgerAccounts, useRegisters } from '../../hooks/useCashQueries';
import { CashApiError } from '../../services/cash.api';
import type { CashRegister } from '../../types/cash.types';
import { CashCard, CashNotice } from '../CashLayout';

import { RegisterFormDialog } from './RegisterFormDialog';

const TYPE_LABELS = { REGISTRADORA: 'Registradora', GENERAL: 'General', MENOR: 'Caja menor' };

/** Cajas del restaurante: crear, editar y activar/desactivar. */
export function RegistersCard({ restaurantId }: { restaurantId: string }) {
  const registers = useRegisters(restaurantId);
  const accounts = useLedgerAccounts(restaurantId);
  const { updateRegister } = useCashConfigActions(restaurantId);
  const [editing, setEditing] = useState<CashRegister | 'new' | null>(null);
  const [blockedId, setBlockedId] = useState<string | null>(null);

  async function toggleActive(register: CashRegister) {
    setBlockedId(null);
    const result = await updateRegister.run({
      registerId: register.id,
      input: { isActive: !register.isActive },
    });
    if (
      !result.ok &&
      result.error instanceof CashApiError &&
      result.error.code === 'REGISTER_HAS_OPEN_SHIFT'
    ) {
      setBlockedId(register.id);
    }
  }

  const accountName = (id: string) => {
    const account = accounts.data?.find((a) => a.id === id);
    return account ? `${account.code} · ${account.name}` : id;
  };

  return (
    <CashCard
      title="Cajas"
      actions={
        <Button size="sm" onClick={() => setEditing('new')} disabled={accounts.isError}>
          Nueva caja
        </Button>
      }
    >
      {accounts.isError && (
        <div className="mb-3">
          <CashNotice tone="warning">
            Necesitás permiso para ver el plan de cuentas para crear o editar cajas.
          </CashNotice>
        </div>
      )}
      {blockedId && (
        <div className="mb-3">
          <CashNotice tone="warning" title="La caja tiene un turno abierto">
            Cerrá el turno antes de desactivarla.
          </CashNotice>
        </div>
      )}
      {registers.isLoading ? (
        <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>
      ) : (registers.data ?? []).length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--t-text-3)]">Todavía no hay cajas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[var(--t-text-3)]">
                <th className="py-2 pr-3 font-semibold">Nombre</th>
                <th className="py-2 pr-3 font-semibold">Tipo</th>
                <th className="py-2 pr-3 font-semibold">Cuenta contable</th>
                <th className="py-2 pr-3 text-right font-semibold">Diferencia tolerada</th>
                <th className="py-2 pr-3 font-semibold">Estado</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--t-border)]">
              {registers.data?.map((r) => (
                <tr key={r.id} className="text-[var(--t-text-1)]">
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  <td className="py-2 pr-3">{TYPE_LABELS[r.type]}</td>
                  <td className="py-2 pr-3">{accountName(r.ledgerAccountId)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.type === 'REGISTRADORA' ? formatCOP(r.diffThreshold) : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant={r.isActive ? 'success' : 'default'}>
                      {r.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="space-x-3 whitespace-nowrap py-2 text-right">
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#FF6A1A] hover:underline"
                      onClick={() => setEditing(r)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--t-text-2)] hover:underline"
                      onClick={() => toggleActive(r)}
                    >
                      {r.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <RegisterFormDialog
          restaurantId={restaurantId}
          register={editing === 'new' ? undefined : editing}
          accounts={accounts.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </CashCard>
  );
}
