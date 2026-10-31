import { formatBogotaTime } from '@/lib/shared/bogotaDate';
import { formatCOP } from '@/lib/shared/money';

import {
  canReverseMovement,
  methodTypeLabel,
  movementStatusLabel,
  movementTypeLabel,
} from '../../helpers/shift.helpers';

import type { MovementsListProps } from './MovementsList.types';

/**
 * Lista de movimientos (tipo, medio, monto, comprobante, estado, hora). No calcula ni muestra
 * totales: el cajero no debe poder deducir el esperado del turno.
 */
export function MovementsList({
  movements,
  emptyText = 'Todavía no hay movimientos.',
  onReverse,
}: MovementsListProps) {
  if (movements.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--t-text-3)]">{emptyText}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-[var(--t-text-3)]">
            <th className="py-2 pr-3 font-semibold">Tipo</th>
            <th className="py-2 pr-3 font-semibold">Medio</th>
            <th className="py-2 pr-3 text-right font-semibold">Monto</th>
            <th className="py-2 pr-3 font-semibold">Comprobante</th>
            <th className="py-2 pr-3 font-semibold">Estado</th>
            <th className="py-2 pr-3 font-semibold">Hora</th>
            {onReverse && <th className="py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--t-border)]">
          {movements.map((m) => (
            <tr key={m.id} className="text-[var(--t-text-1)]">
              <td className="py-2 pr-3">
                <span className="font-medium">{movementTypeLabel(m.type)}</span>
                {m.reason && <p className="text-xs text-[var(--t-text-3)]">{m.reason}</p>}
              </td>
              <td className="py-2 pr-3">{methodTypeLabel(m.methodType)}</td>
              <td
                className={`py-2 pr-3 text-right font-semibold tabular-nums ${
                  m.direction === 'IN' ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {m.direction === 'IN' ? '+' : '-'}
                {formatCOP(m.amount)}
              </td>
              <td className="py-2 pr-3 tabular-nums">{m.receiptNumber}</td>
              <td className="py-2 pr-3">
                <span
                  className={
                    m.status === 'PENDIENTE_APROBACION'
                      ? 'font-semibold text-amber-600'
                      : m.status === 'RECHAZADO'
                        ? 'text-red-500'
                        : ''
                  }
                >
                  {movementStatusLabel(m.status)}
                </span>
                {m.reversedByMovementId && (
                  <span className="ml-1 text-xs text-[var(--t-text-3)]">(reversado)</span>
                )}
              </td>
              <td className="whitespace-nowrap py-2 pr-3">{formatBogotaTime(m.createdAt)}</td>
              {onReverse && (
                <td className="py-2 text-right">
                  {canReverseMovement(m) && (
                    <button
                      type="button"
                      onClick={() => onReverse(m)}
                      className="text-xs font-semibold text-red-500 hover:underline"
                    >
                      Reversar
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
