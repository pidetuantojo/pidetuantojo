'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { getPaymentLabel } from '@/features/payment-methods/helpers/payment-methods.helpers';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { formatCOP } from '@/lib/shared/money';

import {
  accountLabel,
  generalRegisters,
  nonCashMethods,
  postableAccounts,
} from '../../helpers/approvals.helpers';
import { sortDenominations } from '../../helpers/count.helpers';
import { useLedgerAccounts, useRegisters } from '../../hooks/useCashQueries';
import { useCashConfigActions } from '../../hooks/useCashConfigActions';
import { useCashSettings } from '../../hooks/useCashSettings';
import type { CashSettings } from '../../types/cash.types';
import { CashCard } from '../CashLayout';

interface SettingsFormProps {
  restaurantId: string;
  settings: CashSettings;
}

function SettingsForm({ restaurantId, settings }: SettingsFormProps) {
  const { data: restaurant } = useRestaurant(restaurantId);
  const registers = useRegisters(restaurantId);
  const accounts = useLedgerAccounts(restaurantId);
  const { updateSettings } = useCashConfigActions(restaurantId);
  const [defaultGeneral, setDefaultGeneral] = useState(settings.defaultGeneralRegisterId ?? '');
  const [mapping, setMapping] = useState<Record<string, string>>(settings.paymentMethodAccounts);
  const methods = nonCashMethods(restaurant?.paymentMethods);
  const accountOptions = postableAccounts(accounts.data ?? []).map((a) => ({
    value: a.id,
    label: accountLabel(a),
  }));

  function save() {
    const paymentMethodAccounts = Object.fromEntries(
      Object.entries(mapping).filter(([, account]) => !!account)
    );
    return updateSettings.run({
      denominations: settings.denominations,
      paymentMethodAccounts,
      ...(defaultGeneral ? { defaultGeneralRegisterId: defaultGeneral } : {}),
    });
  }

  return (
    <div className="space-y-5">
      <Select
        label="Caja general por defecto"
        value={defaultGeneral}
        onChange={setDefaultGeneral}
        placeholder="Elegí una caja general"
        options={generalRegisters(registers.data ?? []).map((r) => ({
          value: r.id,
          label: r.name,
        }))}
      />

      <div className="space-y-3">
        <p className="text-sm font-semibold text-[var(--t-text-2)]">
          Cuenta contable por medio de pago
        </p>
        {methods.length === 0 && (
          <p className="text-xs text-[var(--t-text-3)]">
            No hay medios de pago distintos de efectivo activos.
          </p>
        )}
        {methods.map((m) => (
          <Select
            key={m.id}
            label={`${getPaymentLabel(m)}${m.account ? ` · ${m.account}` : ''}`}
            value={mapping[m.id] ?? ''}
            onChange={(value) => setMapping((prev) => ({ ...prev, [m.id]: value }))}
            placeholder="Elegí la cuenta"
            options={accountOptions}
            searchable
          />
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-[var(--t-text-2)]">
          Denominaciones (solo lectura)
        </p>
        <ul className="flex flex-wrap gap-2">
          {sortDenominations(settings.denominations).map((d) => (
            <li
              key={d.key}
              className="rounded-full border border-[var(--t-border)] px-3 py-1 text-xs text-[var(--t-text-2)]"
            >
              {d.kind === 'BILLETE' ? 'Billete' : 'Moneda'} {formatCOP(d.value)}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} isLoading={updateSettings.isPending}>
          Guardar ajustes
        </Button>
      </div>
    </div>
  );
}

/** Ajustes de caja: caja general por defecto, cuenta por medio de pago y denominaciones. */
export function SettingsCard({ restaurantId }: { restaurantId: string }) {
  const settings = useCashSettings(restaurantId);
  return (
    <CashCard title="Ajustes de caja">
      {settings.isLoading || !settings.data ? (
        <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>
      ) : (
        <SettingsForm
          key={settings.data.updatedAt ?? 'initial'}
          restaurantId={restaurantId}
          settings={settings.data}
        />
      )}
    </CashCard>
  );
}
