'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth';
import { CashCard, CashNotice, CashPageHeader } from '@/features/cash/components/CashLayout';

import { buildAccountRows } from '../../helpers/accounts.helpers';
import { CLASS_LABELS, NATURE_LABELS } from '../../helpers/ledger-labels.helpers';
import { useAccountActions } from '../../hooks/useLedgerActions';
import { useLedgerAccounts } from '../../hooks/useLedgerQueries';
import type { LedgerAccount } from '../../types/ledger.types';
import { LedgerModuleGate } from '../LedgerModuleGate';
import { LedgerNav } from '../LedgerNav';

import { AccountFormDialog } from './AccountFormDialog';

type DialogState = { mode: 'create' } | { mode: 'edit'; account: LedgerAccount } | null;

function ChartView({ restaurantId }: { restaurantId: string }) {
  const { can } = useAuth();
  const canManage = can('ledger.manage');
  const accountsQuery = useLedgerAccounts(restaurantId);
  const { setup } = useAccountActions();
  const [dialog, setDialog] = useState<DialogState>(null);
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const rows = useMemo(() => buildAccountRows(accounts), [accounts]);

  if (accountsQuery.isLoading) return <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>;
  if (accountsQuery.isError) {
    return <CashNotice tone="danger">No se pudo cargar el plan de cuentas.</CashNotice>;
  }

  if (accounts.length === 0) {
    return (
      <CashCard>
        <div className="space-y-3 py-6 text-center">
          <p className="text-base font-bold text-[var(--t-text-1)]">
            Todavía no hay plan de cuentas
          </p>
          <p className="text-sm text-[var(--t-text-3)]">
            Inicializalo con las cuentas y reglas sugeridas; el contador las valida después.
          </p>
          {canManage && (
            <Button onClick={() => setup.run()} isLoading={setup.isPending}>
              Inicializar plan de cuentas
            </Button>
          )}
        </div>
      </CashCard>
    );
  }

  return (
    <CashCard
      title="Cuentas"
      description="Ordenadas por código. El código de una cuenta nunca cambia."
      actions={
        canManage && (
          <Button size="sm" onClick={() => setDialog({ mode: 'create' })}>
            Nueva cuenta
          </Button>
        )
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-[var(--t-text-3)]">
              <th className="py-2 pr-3 font-semibold">Código</th>
              <th className="py-2 pr-3 font-semibold">Nombre</th>
              <th className="py-2 pr-3 font-semibold">Clase</th>
              <th className="py-2 pr-3 font-semibold">Naturaleza</th>
              <th className="py-2 pr-3 font-semibold">Estado</th>
              {canManage && <th className="py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--t-border)] text-[var(--t-text-1)]">
            {rows.map(({ account, depth }) => (
              <tr key={account.id} className={account.isActive ? '' : 'opacity-60'}>
                <td className="py-2 pr-3 font-mono">{account.code}</td>
                <td className="py-2 pr-3" style={{ paddingLeft: depth * 16 }}>
                  <span className={account.allowsMovements ? '' : 'font-semibold'}>
                    {account.name}
                  </span>
                  {account.needsAccountantReview && (
                    <span className="ml-2">
                      <Badge variant="warning">A validar por el contador</Badge>
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3">{CLASS_LABELS[account.class]}</td>
                <td className="py-2 pr-3">{NATURE_LABELS[account.nature]}</td>
                <td className="py-2 pr-3">
                  {!account.isActive && <Badge variant="danger">Inactiva</Badge>}
                  {account.isActive && !account.allowsMovements && <Badge>Agrupación</Badge>}
                  {account.isActive && account.allowsMovements && (
                    <Badge variant="success">Activa</Badge>
                  )}
                </td>
                {canManage && (
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDialog({ mode: 'edit', account })}
                    >
                      Editar
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog && (
        <AccountFormDialog
          account={dialog.mode === 'edit' ? dialog.account : undefined}
          accounts={accounts}
          onClose={() => setDialog(null)}
        />
      )}
    </CashCard>
  );
}

/** Plan de cuentas: lista con sangría por jerarquía; el contador crea y edita cuentas. */
export function ChartOfAccounts() {
  return (
    <LedgerModuleGate permission="ledger.view">
      {(restaurantId) => (
        <div className="space-y-5">
          <CashPageHeader
            title="Plan de cuentas"
            description='Las cuentas marcadas "a validar por el contador" son sugerencias iniciales.'
          />
          <LedgerNav />
          <ChartView restaurantId={restaurantId} />
        </div>
      )}
    </LedgerModuleGate>
  );
}
