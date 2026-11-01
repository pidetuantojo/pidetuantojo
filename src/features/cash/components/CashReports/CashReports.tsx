'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

import { CashPageHeader } from '../CashLayout';
import { CashModuleGate } from '../CashModuleGate';

import { DailyReportTab } from './DailyReportTab';
import { PettyReportTab } from './PettyReportTab';
import { ShiftReportTab } from './ShiftReportTab';

const TABS = [
  { id: 'daily', label: 'Resumen diario' },
  { id: 'shift', label: 'Cierre por turno' },
  { id: 'petty', label: 'Caja menor' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function ReportsView({ restaurantId }: { restaurantId: string }) {
  const [tab, setTab] = useState<TabId>('daily');
  return (
    <div className="space-y-5">
      <CashPageHeader
        title="Reportes de caja"
        description="Resumen diario por caja y medio de pago, cierre por turno y estado de caja menor."
      />
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
              tab === t.id ? 'bg-[#FF6A1A] text-white' : 'text-[var(--t-text-2)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'daily' && <DailyReportTab restaurantId={restaurantId} />}
      {tab === 'shift' && <ShiftReportTab restaurantId={restaurantId} />}
      {tab === 'petty' && <PettyReportTab restaurantId={restaurantId} />}
    </div>
  );
}

/** Reportes de caja para supervisores (`cash.approve`). */
export function CashReports() {
  return (
    <CashModuleGate permission="cash.approve">
      {(restaurantId) => <ReportsView restaurantId={restaurantId} />}
    </CashModuleGate>
  );
}
