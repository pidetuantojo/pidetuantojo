import { TrendingUp, ShoppingBag, DollarSign, CreditCard, Package } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';

import type { AccountingSummaryProps } from './AccountingSummary.types';

export function AccountingSummary({ stats }: AccountingSummaryProps) {
  const { totalRevenue, orderCount, avgTicket, byPaymentMethod, byProduct } = stats;

  const maxUnits = byProduct[0]?.units ?? 1;
  const totalUnits = byProduct.reduce((acc, p) => acc + p.units, 0);

  return (
    <div className="space-y-5">
      {/* 3 stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-orange-500" />}
          iconBg="bg-orange-50"
          label="Ingresos"
          value={formatCurrency(totalRevenue)}
          valueColor="text-orange-500"
        />
        <StatCard
          icon={<ShoppingBag className="h-5 w-5 text-blue-500" />}
          iconBg="bg-blue-50"
          label={`Pedidos · ${formatCurrency(avgTicket)} prom.`}
          value={String(orderCount)}
          valueColor="text-blue-600"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
          iconBg="bg-purple-50"
          label="Ticket promedio"
          value={formatCurrency(avgTicket)}
          valueColor="text-purple-600"
        />
      </div>

      {/* Desglose por método de pago — tarjetas */}
      {Object.keys(byPaymentMethod).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(byPaymentMethod)
            .sort(([, a], [, b]) => b.total - a.total)
            .map(([method, { total, count }]) => (
              <div
                key={method}
                className="flex items-center justify-between rounded-2xl p-5"
                style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--t-text-1)' }}>{method}</p>
                    <p className="text-xs" style={{ color: 'var(--t-text-4)' }}>{count} pedido{count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <p className="text-xl font-black text-blue-600">{formatCurrency(total)}</p>
              </div>
            ))}
        </div>
      )}

      {/* Unidades vendidas por producto */}
      {byProduct.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              <h3 className="font-bold" style={{ color: 'var(--t-text-1)' }}>Unidades vendidas por producto</h3>
            </div>
            <span
              className="rounded-full px-3 py-0.5 text-xs font-semibold"
              style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-3)' }}
            >
              {byProduct.length} producto{byProduct.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-3">
            {byProduct.map(({ name, units }) => (
              <div key={name} className="flex items-center gap-3">
                <span className="w-6 flex-shrink-0 text-right text-sm font-black" style={{ color: 'var(--t-text-2)' }}>
                  {units}
                </span>
                <div className="flex-1">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium" style={{ color: 'var(--t-text-2)' }}>{name}</span>
                    <span className="text-xs" style={{ color: 'var(--t-text-4)' }}>
                      {totalUnits > 0 ? Math.round((units / totalUnits) * 100) : 0}%
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ background: 'var(--t-surface-2)' }}
                  >
                    <div
                      className="h-2 rounded-full bg-orange-500 transition-all duration-500"
                      style={{ width: `${(units / maxUnits) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor: string;
}

function StatCard({ icon, iconBg, label, value, valueColor }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--t-text-3)' }}>{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-black ${valueColor}`}>{value}</p>
    </div>
  );
}
