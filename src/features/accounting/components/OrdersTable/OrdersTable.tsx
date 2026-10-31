import { useState } from 'react';
import { Bike, Download, Eye, ShoppingBag, UtensilsCrossed } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Order } from '@/types';

import { isCancelledOrder } from '../../helpers/accounting.helpers';
import { deliveryLabel } from '../../helpers/orderDetail.helpers';
import { OrderDetailDrawer } from '../OrderDetailDrawer';
import type { OrdersTableProps } from './OrdersTable.types';

const DELIVERY_ICON = { domicilio: Bike, mesa: UtensilsCrossed, recoger: ShoppingBag };

export function OrdersTable({ orders, statuses, onExport }: OrdersTableProps) {
  const [selected, setSelected] = useState<Order | null>(null);
  const statusMap = new Map(statuses.map((s) => [s.id, s]));
  const total = orders.reduce((acc, o) => (isCancelledOrder(o, statuses) ? acc : acc + o.total), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--t-text-2)' }}>
          Detalle de pedidos ({orders.length})
        </h3>
        {orders.length > 0 && onExport && (
          <Button variant="secondary" size="sm" onClick={onExport}>
            <Download className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>
        )}
      </div>

      {orders.length === 0 ? (
        <div
          className="rounded-xl border-dashed py-10 text-center"
          style={{ border: '1px dashed var(--t-border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--t-text-4)' }}>Sin pedidos en el rango seleccionado.</p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-xl"
          style={{ border: '1px solid var(--t-border)' }}
        >
          <table className="w-full min-w-[760px] text-sm">
            <thead style={{ background: 'var(--t-surface-2)' }}>
              <tr>
                {['Fecha', 'Pedido', 'Cliente', 'Entrega', 'Estado', 'Método', 'Items', 'Total', ''].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--t-text-3)' }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody
              className="divide-y"
              style={{
                background: 'var(--t-surface)',
                borderColor: 'var(--t-border)',
              }}
            >
              {orders.map((order) => {
                const status = statusMap.get(order.statusId);
                const cancelled = status?.code === 'cancelled';
                const DeliveryIcon = DELIVERY_ICON[order.deliveryType ?? 'recoger'];
                return (
                  <tr
                    key={order.id}
                    className="transition-colors"
                    style={{ ['--tw-divide-opacity' as string]: 1, opacity: cancelled ? 0.5 : 1 }}
                    title={cancelled ? 'Cancelado: no suma en los totales' : undefined}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--t-surface-2)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = '')
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs" style={{ color: 'var(--t-text-3)' }}>
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--t-text-1)' }}>
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--t-text-1)' }}>{order.customerName}</p>
                      <p className="text-xs" style={{ color: 'var(--t-text-4)' }}>{order.customerPhone}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--t-text-2)' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <DeliveryIcon className="h-3.5 w-3.5" style={{ color: 'var(--t-text-4)' }} />
                        {deliveryLabel(order)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {status && (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                          style={{ backgroundColor: status.color }}
                        >
                          {status.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--t-text-2)' }}>{order.paymentMethod}</td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--t-text-2)' }}>{order.items.length}</td>
                    <td
                      className="px-4 py-3 text-right font-semibold"
                      style={{ color: 'var(--t-text-1)', textDecoration: cancelled ? 'line-through' : undefined }}
                    >
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(order)}
                        aria-label={`Ver detalle del pedido ${order.orderNumber}`}
                        title="Ver detalle"
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--t-surface-2)]"
                        style={{ color: '#FF6A1A', border: '1px solid var(--t-border)' }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ borderTop: '2px solid var(--t-border-2)', background: 'var(--t-surface-2)' }}>
              <tr>
                <td colSpan={7} className="px-4 py-3 text-right text-sm font-bold" style={{ color: 'var(--t-text-2)' }}>
                  Total
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: 'var(--t-text-1)' }}>
                  {formatCurrency(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <OrderDetailDrawer order={selected} statuses={statuses} onClose={() => setSelected(null)} />
    </div>
  );
}
