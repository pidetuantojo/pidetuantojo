'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth';
import { CashCard, CashNotice, CashPageHeader } from '@/features/cash/components/CashLayout';
import { useConfirmStore } from '@/store/confirm.store';

import { describeRef, EVENT_LABELS, METHOD_LABELS } from '../../helpers/ledger-labels.helpers';
import { groupRulesByEvent, isLiveRule } from '../../helpers/rules.helpers';
import { useRuleActions } from '../../hooks/useLedgerActions';
import { useLedgerAccounts, useLedgerRules } from '../../hooks/useLedgerQueries';
import type { AccountingRule } from '../../types/ledger.types';
import { LedgerModuleGate } from '../LedgerModuleGate';
import { LedgerNav } from '../LedgerNav';

import { RuleEditDialog } from './RuleEditDialog';

function RulesView({ restaurantId }: { restaurantId: string }) {
  const { can } = useAuth();
  const canManage = can('ledger.manage');
  const rulesQuery = useLedgerRules(restaurantId);
  const accountsQuery = useLedgerAccounts(restaurantId);
  const { deactivate } = useRuleActions();
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState<AccountingRule | null>(null);
  const showConfirm = useConfirmStore((st) => st.showConfirm);

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const groups = useMemo(
    () => groupRulesByEvent(rulesQuery.data ?? [], showHistory),
    [rulesQuery.data, showHistory]
  );

  async function confirmDeactivate(rule: AccountingRule) {
    const ok = await showConfirm({
      title: 'Desactivar regla',
      message: `Sin una regla vigente, los movimientos de "${EVENT_LABELS[rule.event]}" no podrán asentarse. ¿Desactivarla?`,
      confirmLabel: 'Desactivar',
    });
    if (ok) await deactivate.run(rule.id);
  }

  if (rulesQuery.isLoading) return <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>;
  if (rulesQuery.isError) {
    return <CashNotice tone="danger">No se pudieron cargar las reglas contables.</CashNotice>;
  }
  if (groups.length === 0 && !showHistory) {
    return (
      <CashNotice>
        Todavía no hay reglas. Inicializá el plan de cuentas desde &quot;Plan de cuentas&quot;.
      </CashNotice>
    );
  }

  return (
    <div className="space-y-4">
      <CashNotice title="Cómo funcionan las reglas">
        Cada regla dice qué cuenta se debita y cuál se acredita para un evento. Editar una regla
        crea una versión nueva y nunca modifica los asientos pasados.
      </CashNotice>
      <label className="flex items-center gap-2 text-sm text-[var(--t-text-2)]">
        <input
          type="checkbox"
          checked={showHistory}
          onChange={(e) => setShowHistory(e.target.checked)}
        />
        Mostrar versiones anteriores y reglas desactivadas
      </label>

      {groups.map((group) => (
        <CashCard key={group.event} title={EVENT_LABELS[group.event]}>
          <div className="divide-y divide-[var(--t-border)]">
            {group.rules.map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <div className="w-40 font-semibold text-[var(--t-text-1)]">
                  {rule.methodType ? METHOD_LABELS[rule.methodType] : 'Cualquier medio'}
                </div>
                <div className="min-w-0 flex-1 text-[var(--t-text-2)]">
                  <p>
                    <span className="font-semibold">Débito:</span>{' '}
                    {describeRef(rule.debit, accountsById)}
                  </p>
                  <p>
                    <span className="font-semibold">Crédito:</span>{' '}
                    {describeRef(rule.credit, accountsById)}
                  </p>
                </div>
                <Badge>v{rule.version}</Badge>
                {!isLiveRule(rule) && (
                  <Badge variant="danger">
                    {rule.supersededAt ? 'Reemplazada' : 'Desactivada'}
                  </Badge>
                )}
                {canManage && isLiveRule(rule) && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(rule)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => confirmDeactivate(rule)}>
                      Desactivar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CashCard>
      ))}
      {editing && (
        <RuleEditDialog rule={editing} accounts={accounts} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

/** Reglas contables por evento: qué cuenta se debita y cuál se acredita. */
export function AccountingRules() {
  return (
    <LedgerModuleGate permission="ledger.view">
      {(restaurantId) => (
        <div className="space-y-5">
          <CashPageHeader
            title="Reglas contables"
            description="Definen cómo cada operación de caja se convierte en un asiento."
          />
          <LedgerNav />
          <RulesView restaurantId={restaurantId} />
        </div>
      )}
    </LedgerModuleGate>
  );
}
